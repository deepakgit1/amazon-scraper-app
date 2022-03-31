const express = require('express')
const passport = require("passport")
const User = require("../models/usermodel")
const router = express()
const crypto = require('crypto')
const async = require('async')
const nodemailer = require('nodemailer')

//Checking user Athentication 
function isAuthenticatedUser(req,res,next){
    if(req.isAuthenticated()){
        return next()
    }
    req.flash("error_msg","Please login first to access this page.")
    res.redirect("/login")
}

//Get Routes
router.get("/logout",(req,res)=>{
    req.logOut()
    req.flash("success_msg","You have been logged out.")
    res.redirect("/login");    
})

router.get("/forgot",(req,res)=>{
    res.render("./users/forgot")
})

router.get('/reset/:token',(req,res)=>{
    User.findOne({resetPasswordToken: req.params.token, resetPasswordExpires:{$gt: Date.now()}})
    .then(user=>{
        if(!user){
            req.flash("error_msg","Password token is invalid or Expired.")
            res.redirect('/forgot');
        }
        res.render('./users/newpassword',{token:req.params.token})
    }).catch(err=>{
        req.flash("error_msg","Error : "+err)
        res.redirect("/forgot")
    })
})

router.get("/login",(req,res)=>{
    res.render("./users/login")
})

router.get("/signup",(req,res)=>{
    res.render("./users/signup")
})  

router.get("/password/change",isAuthenticatedUser,(req,res)=>{
    res.render("./users/changepassword")
})

router.get('/users/all',isAuthenticatedUser,(req,res)=>{
    let loginUser = req.user
    User.find({})
    .then(users=>{
        res.render("./users/allusers",{users:users,loginUser:loginUser})
    }).catch(err=>{
        console.log(err);
    })
});

router.get("/edit/:id",isAuthenticatedUser,(req,res)=>{
    let searchQuery ={_id : req.params.id}
    User.findOne(searchQuery)
    .then(user=>{
        res.render("./users/editusers",{user:user})
    }).catch(err=>{
        req.flash("error_msg","Error :"+err)
        res.redirect("users/all")
    })
})



//Post Routes
router.post('/login',passport.authenticate('local',{
    successRedirect: "/dashboard",
    failureRedirect: "/login",
    failureFlash: "Invalid email or password. Try again!!!"   
}))

router.post("/signup",(req,res)=>{
    let {name,email,password} = req.body
    let userData = {
        name : name,
        email: email
    };

    User.register(userData,password,(err,user)=>{
        if(err){
            req.flash('error_msg',"Error : "+ err)
            res.redirect("/signup")
        }
        req.flash('success_msg','Account Created Suucessfully');
        res.redirect('/signup')
    });

})

//Routes to handle forgot password
router.post('/forgot',(req,res,next)=>{
    let recoveryPassword = "";
    async.waterfall([
        (done)=>{
            crypto.randomBytes(20,(err,buf)=>{
                let token = buf.toString('hex')
                done(err,token)
            })
        },
        (token,done)=>{
            User.findOne({email:req.body.email})
            .then(user=>{
                if(!user){
                    req.flash("error_msg","User does not exist with this email")
                   return res.redirect('/forgot')
                }
                user.resetPasswordToken = token
                user.resetPasswordExpires = Date.now() + 1800000; //milisec to 1/2hours
                user.save(err=>{
                    done(err,token,user);
                })
            }).catch(err=>{
                req.flash("error_msg","Error : "+err)
                res.redirect("/forgot")
            })
        },

        (token,user)=>{
            //SMTP = simple mail transfer protocol
            let smtpTransport = nodemailer.createTransport({
                service: "Gmail",
                auth : {
                    user: process.env.GMAIL_EMAIL,
                    pass : process.env.GMAIL_PASSWORD
                }
            });
            let mailOptions = {
                to : user.email,
                from : "Deepak Gaidhane deepakgaidhane@gmail.com",
                subject: "Recovery email from Auth Project",
                text : "Please click the following link to recover your password: \n\n"+
                        'http://'+ req.headers.host + "/reset/"+ token + '\n\n'+
                        'If you did not request this, Please ignor this email.'
            };
            smtpTransport.sendMail(mailOptions,err=>{
                req.flash('success_msg',"Email Send with further instructions. Please Check your mail.")
                res.redirect('/forgot')
            })
        }
    
    ],err=>{
        if(err) res.redirect('/forgot')
    });
});


////Routes to handle forgot password New password Request 
router.post('/reset/:token',(req,res)=>{
    async.waterfall([

        (done)=>{
            User.findOne({resetPasswordToken: req.params.token, resetPasswordExpires:{$gt: Date.now()}})
            .then(user=>{
                if(!user){
                    req.flash("error_msg","Password reset token is invalid or Expired.")
                    res.redirect('/forgot');
                }
                if(req.body.password !== req.body.confirmpassword){
                    req.flash("error_msg","Password does not match.Please check.")
                    return res.redirect('/forgot');
                }

                user.setPassword(req.body.password,err=>{
                    user.resetPasswordToken = undefined;
                    user.resetPasswordExpires = undefined;
                    user.save(err=>{
                        req.login(user,err=>{
                            done(err,user);
                        })
                    })
                })

            }).catch(err=>{
                req.flash("error_msg","Error "+ err)
                res.redirect('/forgot')
            });      
        },
        (user)=>{
            let smtpTransport = nodemailer.createTransport({
                service:"Gmail",
                auth:{
                    user: process.env.GMAIL_EMAIL,
                    pass: process.env.GMAIL_PASSWORD 
                }
            });
            let mailOptions = {
                to : user.email,
                from : "Deepak Gaidhane deepakgaidhane@gmail.com",
                subject : "Your Password Has been Changed",
                text : "Hello, "+user.name+'\n\n'+
                    'This is the Confirmation email for Password for your account '+user.email+' has been Changed.'
            };
            smtpTransport.sendMail(mailOptions,err=>{
                req.flash('success_msg',"Your Password has been Changed Successfully.")
                res.redirect('/login')
            })
        }


    ],err=>{
        res.redirect('/login')
    })
});

router.post("/password/change",(req,res)=>{
    if(req.body.password !== req.body.confirmpassword){
        req.flash("error_msg","Password does not match. Please Try again!")
       return  res.redirect("/password/change")
    }
    User.findOne({email : req.user.email})
    .then(user=>{
        user.setPassword(req.body.password, err=>{
            user.save().then(user=>{
                req.flash("success_msg","Password Changed Successfully.")
                res.redirect('/password/change')
            })
        })
    }).catch(err=>{
        req.flash("error_msg",'Error :'+err)
        res.redirect('/password/change')
    })
})

//Put routes Started here
router.put("/edit/:id",(req,res)=>{
    let searchQuery ={_id : req.params.id}
    User.updateOne(searchQuery,{$set:{
        name: req.body.name,
        email:req.body.email
    }}).then(user=>{
        req.flash("success_msg","User Updated successfully")
        res.redirect("/users/all");
    }).catch(err=>{
        req.flash("error_msg","Error :"+err)
        res.redirect("users/all")
    })
})

//Delete routes starts here

router.delete("/delete/:id",(req,res)=>{
    let searchQuery = {_id:req.params.id}
    User.deleteOne(searchQuery)
    .then(user=>{
        req.flash("success_msg","User Deleted successfully")
        res.redirect("/users/all");
    }).catch(err=>{
        req.flash("error_msg","Error :"+err)
        res.redirect("users/all")
    })
})

module.exports = router;