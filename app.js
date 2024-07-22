const express = require('express')
const mongoose = require('mongoose')
const cors=require('cors')
const path=require('path')
require('dotenv').config();
const cookieParser=require('cookie-parser')
const app = express()
const DBURL=process.env.DBURL
const PORT =process.env.PORT || 4000
mongoose.connect(DBURL)
const connection = mongoose.connection
connection.on('open', () => console.log('Database Connection Established...'))

app.listen(PORT, () => console.log('Server started on port ' + PORT))
app.use('/uploads', express.static(path.join(__dirname, 'UploadedFiles')));

app.use(express.json({ limit: '500mb' }));
app.use(cookieParser())
const frontendOrigin = process.env.FRONTEND_ORIGIN;
console.log(frontendOrigin)
app.use(cors({
  origin: frontendOrigin,
  credentials: true // Allow credentials (cookies) to be sent
}));

const authRouter = require('./Routes/auth.js')
app.use('/auth', authRouter)


const foldersRouter = require('./Routes/folders.js')
app.use('/folders', foldersRouter)


const notificationRouter = require('./Routes/notification.js')
app.use('/notification', notificationRouter)



