const mongoose = require('mongoose')
const { isEmail, isIn } = require('validator')
const bcrypt=require('bcrypt')

const UserSchema = mongoose.Schema({
    username: {
        type: String,
        required: [true, "Please enter the username"],
        unique:true
    },
    password: {
        type: String,
        required: [true, "Please enter the password"],
        minLength:[8,"minimum password length is 8 character"]
    },
    firstName: {
        type: String
    },
    lastName: {
        type: String
    },
    organizationName: {
        type: String
    },
    role: {
        type: String
   
    }
})


UserSchema.pre('save', async function (next) {
    const salt=await bcrypt.genSalt()
    this.password =await bcrypt.hash(this.password, salt)
    console.log('pre save = ', this.password)
    next()
})


UserSchema.statics.login = async function(username, password) {
    const user = await this.findOne({ username })
    if (user) {
        if ( await bcrypt.compare(password, user.password)) {
            return user
        }
        throw Error("password is not correct")
    }throw Error("username is not registered")
}



module.exports=mongoose.model('User',UserSchema)


