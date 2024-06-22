const jwt = require('jsonwebtoken')

const requireAuth = (req, res, next) => {

    const token = req.cookies.jwt


    if (token) {

        jwt.verify(token, process.env.JWT_SECRET, (err) => {
            if (err) {
                res.json({ "error": err })
            } else {
                next()
            }
        }
        )



    }
    else {
        console.log("User has no jwt")
        res.json({ "error": "You have no jwt" })
    }
}






module.exports = { requireAuth }

