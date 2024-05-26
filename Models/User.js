const mongoose = require('mongoose')
const { isEmail, isIn } = require('validator')
const bcrypt=require('bcrypt')
const roles=["visitor", "guide", "admin"]

const UserSchema = mongoose.Schema({
    username: {
        type: String,
        required: [true,"Please enter the user name"]
    },
    email: {
        type: String,
        required: [true,"Please enter your email address"],
        unique: true,
        lowercase: true,
        validate:[isEmail,"Please enter valid email address"]
    },
    password: {
        type: String,
        required: [true, "Please enter the password"],
        minLength:[8,"minimum password length is 8 character"]
    },
    role: {
        type: String,
        enum: roles,
        required: [true, "Please enter the role"]
   
    }
})


UserSchema.post('save',(doc,next)=> {
    console.log("After Saving The Doc : " + doc)
    next()
})

UserSchema.pre('save', async function (next) {
    const salt=await bcrypt.genSalt()
    this.password = await bcrypt.hash(this.password, salt)
    next()
})

//static function for user model
UserSchema.statics.login = async function(email, password) {
    const user = await this.findOne({ email })
    if (user) {
        if ( await bcrypt.compare(password, user.password)) {
            return user
        }
        throw Error("Password is not correct")
    }throw Error("Email not registered")
}





module.exports=mongoose.model('User',UserSchema)
