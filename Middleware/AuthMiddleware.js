const jwt=require('jsonwebtoken')

const requireAuth = (req, res,next) => {
    
    const token=req.cookies.jwt

    if (token) {
        jwt.verify(token, "your secret key here , it should be long , not share to anyone", (err,decodedText) => {
            if (err) {
                res.json({"error":err})
            } else {
                next()
            }
        }
        )



    } else {
        res.json({"error":"You have no jwt"})
    }
}






module.exports={requireAuth}

