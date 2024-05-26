const express = require('express')
const User = require('../Models/User')
const jwt = require('jsonwebtoken')
const router = express.Router()



function handleErrors(err) {
    
    let errors = { username: '', email: '', password: '', role: '' }
    if (err.code == 11000) {
        errors.email = 'This email is already registered'
        return errors
    }
    if (err.message.includes('User validation failed')) {
        Object.values(err.errors).forEach(({ properties }) => {
            errors[properties.path]=properties.message
        })
    }

    return errors

}

function createToken(id) {
   return jwt.sign({ id }, 'your secret key here , it should be long , not share to anyone', { expiresIn:3*24*60*60*1000  })
}
//------/all route is for testing purpose------
router.get('/all', async (req, res) => {
    const users = await User.find()
    res.json(users)
})

router.post('/signup', async(req, res) => {
    const { username, email, password, role } = req.body
    console.log(username,email,password)
    try {
        const createdUser = await User.create({ username, email, password, role })
        const token = createToken(createdUser._id)
        res.cookie('jwt',token,{httpOnly:true,maxAge:3*24*60*60,secure:true})
        res.json({username:createdUser.username,role:createdUser.role})

    } catch (err) {
        
        res.json({ "error": handleErrors(err) })
    }
})

router.post('/login', async (req, res) => {
    const { email, password } = req.body
    
    try {
        
        const user = await User.login(email, password)
        const token = createToken(user._id)
        res.cookie('jwt',token,{maxAge:3*24*60*60*1000,secure:true})
        res.json({ 'role': user.role, "username":user.username})

    } catch (err) {
        console.log("error "+err)
        res.status(400).json({err:err.message})
    }

})

router.get('/logout', (req, res) => {
    res.cookie('jwt', '', { maxAge:1 })
    res.json({'status':"logged out successfully !"})
})

module.exports = router