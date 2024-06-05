const express = require('express')
const User = require('../Models/User')
const jwt = require('jsonwebtoken')
const Folder = require('../Models/Folder')
const router = express.Router()



function handleErrors(err) {

    let errors = { username: '', password: '', role: '' }
    if (err.code == 11000) {
        errors.username = 'This username is already registered'
        return errors
    }
    if (err.message.includes('User validation failed')) {
        Object.values(err.errors).forEach(({ properties }) => {
            errors[properties.path] = properties.message
        })
    }

    return errors

}

function createToken(id) {
    return jwt.sign({ id }, 'your secret key here , it should be long , not share to anyone', { expiresIn: 3 * 24 * 60 * 60 * 1000 })
}

//------/all route is for testing purpose------
router.get('/all', async (req, res) => {
    const users = await User.find()
    res.json(users)
})
router.get('/all/users', async (req, res) => {
    const users = await User.find({ organizationName: '' })
    res.json(users)
})

router.post('/signup', async (req, res) => {
    const { username, firstName, lastName, organizationName, password, role } = req.body
    const data = { username, firstName, lastName, organizationName, password, role }

    try {
        const user = new User(data)
        const createdUser = await user.save()
        const token = createToken(createdUser._id)

        if (organizationName) {

            const newFolder = new Folder({
                name: username,
                path: `/${username}/`,
                files: [],
                subfolders: [],
                owner: username
            });

            const savedFolder = await newFolder.save();
            res.cookie('jwt', token, { httpOnly: true, maxAge: 3 * 24 * 60 * 60, secure: true })
            res.json({ username: createdUser.username, role: createdUser.role, password: createdUser._id, root: savedFolder })
        } else {

            res.cookie('jwt', token, { httpOnly: true, maxAge: 3 * 24 * 60 * 60, secure: true })
            res.json({ username: createdUser.username })
        }

    } catch (err) {
        console.log(err)

        res.json({ "error": handleErrors(err) })
    }
})

router.post('/login', async (req, res) => {
    const { username, password } = req.body

    try {

        const user = await User.login(username, password)
        const token = createToken(user._id)
        if (user.organizationName) {

            const rootFolder = await Folder.findOne({ path: `/${username}/` });
            res.cookie('jwt', token, { maxAge: 3 * 24 * 60 * 60 * 1000*1000, secure: false })
            res.json({ 'role': user.role, "username": user.username, "firstName": user.firstName, 'rootId': rootFolder._id })

        } else {
            const folders = await Folder.find({ $or: [{ read: username }, { write: username }, { readWrite: username }] })

            const usersFolder=[]
            
            for (const folder of folders) {
                const name = folder.name
                const user = await User.findOne({ username: name })
                const organizationName = user.organizationName
                usersFolder.push({username:name,organizationName,rootId:folder._id})
                
            }
               
            res.cookie('jwt', token, { maxAge: 3 * 24 * 60 * 60 * 1000, secure: false })
            res.json({ "username": user.username, "firstName": user.firstName, "lastName":user.lastName,usersFolder })

        }

    } catch (err) {
        console.log("error " + err)
        res.json({ 'error': err.message })
    }

})

router.get('/logout', (req, res) => {
    res.cookie('jwt', '', { maxAge: 1 })
    res.json({ 'status': "logged out successfully !" })
})

router.post('/change_password', async (req, res) => {
    const { username, oldPassword, newPassword } = req.body

    try {

        const user = await User.login(username, oldPassword)
        user.password = newPassword
        await user.save()
        const token = createToken(user._id)
        res.cookie('jwt', token, { maxAge: 3 * 24 * 60 * 60 * 1000, secure: true })
        res.json({ 'old': oldPassword, "new": user.password, "firstName": user.firstName })

    } catch (err) {
        console.log("error " + err)
        res.status(400).json({ err: err.message })
    }

})

module.exports = router