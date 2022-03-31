//main branch added
const express = require("express")
const app = express()

const path = require('path')
const bodyParser = require('body-parser')
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const flash = require('connect-flash')
const session = require("express-session")
const methodOverride = require('method-override')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy

//Requiring user and admin route
const userRoutes = require("./routes/users")
const adminRoutes = require("./routes/admin")
//Requiring user model
const User = require('./models/usermodel')


dotenv.config({ path: "./config.env" })

//connecting to database
mongoose.connect(process.env.DATABASE, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(con=>{
    console.log("Mongo db Online Database connected.");
})


//middleware for sessions
app.use(session({
    secret: "Simple login/signup Application",
    resave: true,
    saveUninitialized: true
}))
app.use(passport.initialize())
app.use(passport.session());
passport.use(new LocalStrategy({ usernameField: "email" }, User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser())

//middleware flash message
app.use(flash());


//Setting middleware globally 
app.use((req, res, next) => {
    res.locals.success_msg = req.flash(('success_msg'))
    res.locals.error_msg = req.flash(('error_msg'))
    res.locals.error = req.flash(('error'))
    res.locals.currentUser = req.user;
    next()
})
app.use(methodOverride('_method'))
app.use(bodyParser.urlencoded({ extended: true }))
app.set("view engine", "ejs")
app.use(express.static('public'));
app.use(userRoutes)
app.use(adminRoutes)
app.listen(process.env.PORT, () => {
    console.log("Server Connected Succesfully");
})