const express = require('express');
const { User, Folder } = require('../Models'); // Assuming you have User and Folder models defined in your Sequelize models
const jwt = require('jsonwebtoken');
const router = express.Router();

function handleErrors(err) {
    let errors = { username: '', password: '', role: '' };

    if (err.name === 'SequelizeUniqueConstraintError') {
        errors.username = 'This username is already registered';
        return errors;
    }

    if (err.name === 'SequelizeValidationError') {
        err.errors.forEach((error) => {
            errors[error.path] = error.message;
        });
    }

    return errors;
}

function createToken(id) {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRATION });
}

//------/all route is for testing purpose------
router.get('/all', async (req, res) => {
    try {
        const users = await req.db.User.findAll();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/all/users', async (req, res) => {
    try {
        const users = await req.db.User.findAll({ where: { organizationName: '' } });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/signup', async (req, res) => {
    const { username, firstName, lastName, organizationName, password, role } = req.body;
    const data = { username, firstName, lastName, organizationName, password, role };

    try {
        const createdUser = await req.db.User.create(data);
        const token = createToken(createdUser.id);

        if (organizationName) {
            const newFolder = await req.db.Folder.create({
                name: username,
                path: `/${username}/`,
                files: [],
                subfolders: [],
                owner: username
            });

            res.cookie('jwt', token, { httpOnly: true, maxAge: 3 * 24 * 60 * 60 * 1000, secure: true, sameSite: "None" });
            res.json({ username: createdUser.username, role: createdUser.role, userId: createdUser.id, root: newFolder });
        } else {
            res.cookie('jwt', token, { httpOnly: true, maxAge: 3 * 24 * 60 * 60 * 1000, secure: true, sameSite: "None" });
            res.json({ username: createdUser.username });
        }
    } catch (err) {
        res.json({ error: handleErrors(err) });
    }
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await req.db.User.login(username, password);
        const token = createToken(user.id);

        if (user.organizationName) {
            const rootFolder = await req.db.Folder.findOne({ where: { path: `/${username}/` } });
            res.cookie('jwt', token, { maxAge: 3 * 24 * 60 * 60 * 1000, secure: true, sameSite: "None" });
            res.cookie('username', username, { maxAge: 3 * 24 * 60 * 60 * 1000, secure: true, sameSite: "None" });
            res.json({ role: user.role, username: user.username, firstName: user.firstName, organizationName: user.organizationName, rootId: rootFolder.id });
        } else {
            const folders = await req.db.Folder.findAll({
                where: {
                    [Op.or]: [
                        { read: { [Op.contains]: [username] } },
                        { write: { [Op.contains]: [username] } },
                        { readWrite: { [Op.contains]: [username] } }
                    ]
                }
            });

            const usersFolder = await Promise.all(folders.map(async (folder) => {
                const name = folder.name;
                const user = await req.db.User.findOne({ where: { username: name } });
                const organizationName = user.organizationName;
                let role;

                if (folder.read.includes(username)) role = "read";
                else if (folder.write.includes(username)) role = "write";
                else if (folder.readWrite.includes(username)) role = "readWrite";
                else role = 'unknown';

                return { username: name, organizationName, role, rootId: folder.id };
            }));

            res.cookie('jwt', token, { maxAge: 3 * 24 * 60 * 60 * 1000, secure: true, sameSite: "None" });
            res.cookie('username', username, { maxAge: 3 * 24 * 60 * 60 * 1000, secure: true, sameSite: "None" });
            res.json({ username: user.username, firstName: user.firstName, lastName: user.lastName, organizationName: user.organizationName, usersFolder });
        }
    } catch (err) {
        res.json({ error: err.message });
    }
});

router.get('/logout', (req, res) => {
    res.cookie('jwt', '', { maxAge: 1 });
    res.json({ status: "Logged out successfully!" });
});

router.post('/change_password', async (req, res) => {
    const { username, oldPassword, newPassword } = req.body;

    try {
        const user = await req.db.User.login(username, oldPassword);
        user.password = newPassword;
        await req.db.User.save();
        const token = createToken(user.id);
        res.cookie('jwt', token, { maxAge: 3 * 24 * 60 * 60 * 1000, secure: true });
        res.json({ old: oldPassword, new: user.password, firstName: user.firstName });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
