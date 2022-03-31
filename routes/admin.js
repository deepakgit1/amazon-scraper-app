const express = require('express')
const router = express.Router()
const puppeteer = require('puppeteer')
const cheerio = require('cheerio')

//requiring product model
let Product = require('../models/product');

//Checking user Athentication 
function isAuthenticatedUser(req,res,next){
    if(req.isAuthenticated()){
        return next()
    }
    req.flash("error_msg","Please login first to access this page.")
    res.redirect("/login")
}

let browser = "";
//Scrape Function 

async function scrapeData(url,page){
    try {
        await page.goto(url,{waitUntil:"load",timeout:0});
        const html = await page.evaluate(()=> document.body.innerHTML);
        const $  =  await cheerio.load(html);

        let title = $('#productTitle').text().trim()
        let price = $('#corePrice_desktop > div > table > tbody > tr:nth-child(2) > td.a-span12 > span.a-price.a-text-price.a-size-medium.apexPriceToPay > span.a-offscreen').text()
        if(!price){
            let newRate = $("#corePriceDisplay_desktop_feature_div > div.a-section.a-spacing-none.aok-align-center > span.a-price.aok-align-center.priceToPay > span:nth-child(2) > span.a-price-whole").text()
            price = newRate
        }
        let seller = $(".a-link-normal > span").text()
        let outofStock = $('#availability > span').text().trim()
        let deliveryNotavailable = $("#AMAZON_DELIVERED > div.a-section.a-spacing-none.icon-content > a").text()
        let stock = "";
        if(outofStock === "Currently unavailable."){
             stock = "Out Of Stock"
        }else{
            stock = "In Stock"
        }

        return{
            title,
            price,
            stock,
            url,
        }

    } catch (error) {
        console.log(error);
    }
}

//Get routes starts here

router.get("/",(req,res)=>{
    res.render("./admin/index")
})

router.get("/dashboard",isAuthenticatedUser,(req,res)=>{
    Product.find({})
    .then(products=>{
        res.render("./admin/dashboard",{products:products})
    })
})

 router.get('/product/new',isAuthenticatedUser, async (req,res)=>{
    try {
        let url = req.query.search
        if(url){
         browser = await puppeteer.launch({headless:true,args: ['--no-sandbox']});
         const page = await browser.newPage()
         let result = await scrapeData(url,page)

         let productData = {
             price: result.price,
             stock : result.stock,
             productUrl : result.url,  
             title: result.title,
         };
         res.render("./admin/newproduct",{productData:productData});
         browser.close()
        }else{
            let productData ={
                title: "",
                price: "",
                stock : "",
                productUrl : ""
            }
            res.render("./admin/newproduct",{productData:productData});
        }
    } catch (error) {
        req.flash("error_msg","Please enter Amazon Url Only.")
        res.redirect("/product/new")
    }
});

router.get("/product/search",isAuthenticatedUser,(req,res)=>{
    let usersku = req.query.sku
    if(usersku){
        Product.findOne({sku:usersku})
        .then(product=>{
            if(!product){
                req.flash("error_msg","Product Does not exists in Database")
                return res.redirect("/product/search")
            }
            res.render("./admin/search",{productData:product})
        }).catch(err=>{
            req.flash("error_msg","Error :"+error)
            res.redirect("/product/new")
        })
    }else{
        res.render("./admin/search",{productData:""})
    }
})
router.get("/products/instock",isAuthenticatedUser,(req,res)=>{
    Product.find({newstock : "In Stock"})
    .then(products=>{
        res.render('./admin/instock',{products:products})
    }).catch(err=>{
        req.flash("error_msg","Error :"+err)
        res.redirect("/dashboard")
    })
});

router.get("/products/outofstock",isAuthenticatedUser,(req,res)=>{
    Product.find({newstock : "Out Of Stock"})
    .then(products=>{
        res.render('./admin/outofstock',{products:products})
    }).catch(err=>{
        req.flash("error_msg","Error :"+err)
        res.redirect("/dashboard")
    })
});

router.get("/products/pricechanged",isAuthenticatedUser,(req,res)=>{
    Product.find({})
    .then(products=>{
        res.render('./admin/pricechanged',{products:products})
    }).catch(err=>{
        req.flash("error_msg","Error :"+err)
        res.redirect("/dashboard")
    })
});  

router.get("/products/backinstock",isAuthenticatedUser,(req,res)=>{
    Product.find({$and:[{oldstock:"Out Of Stock"},{newstock:"In Stock"}]})
    .then(products=>{
        res.render('./admin/backinstock',{products:products})
    }).catch(err=>{
        req.flash("error_msg","Error :"+err)
        res.redirect("/dashboard")
    })
});

router.get("/products/updated",isAuthenticatedUser,(req,res)=>{
    Product.find({updatestatus : "Update"})
    .then(products=>{
        res.render('./admin/updatedproducts',{products:products})
    }).catch(err=>{
        req.flash("error_msg","Error :"+err)
        res.redirect("/dashboard")
    })
});

router.get("/products/notupdated",isAuthenticatedUser,(req,res)=>{
    Product.find({updatestatus : "Not Update"})
    .then(products=>{
        res.render('./admin/notupdatedproducts',{products:products})
    }).catch(err=>{
        req.flash("error_msg","Error :"+err)
        res.redirect("/dashboard")
    })
});

router.get("/update",isAuthenticatedUser,(req,res)=>{
    res.render("./admin/update",{message : ""})
})


//posts routes starts here

router.post("/product/new",isAuthenticatedUser,(req,res)=>{
    let {title,price,stock,url,sku} = req.body;
    let newProduct = {
        title:title,
        newprice : price,
        oldprice : price,
        newstock : stock,
        oldstock : stock,
        sku : sku,
        company : "Amazon",
        url : url,
        updatestatus : "Update"
    };
    Product.findOne({sku:sku})
    .then(product=>{
        if(product){
            req.flash("error_msg","Product Already exists in Database")
            return res.redirect("/product/new")
        }
        Product.create(newProduct)
        .then(product=>{
            req.flash("success_msg","Product added succesfully in Database")
            res.redirect("/product/new")
        })
    }).catch(err=>{
        req.flash("error_msg","Error :"+err)
        res.redirect("/product/new")
    }) 
});

router.post("/update",isAuthenticatedUser, async(req,res)=>{
    try {
        res.render("./admin/update",{message:"update started"})
        Product.find({})
        .then(async products=>{
            for(i=0;i<products.length;i++){
                Product.updateOne({"url" : products[i].url},{$set:{'oldprice':products[i].newprice,'oldstock':products[i].newstock,'updatestatus':"Not Update"}})
                .then(product=>{
                })
            }
            browser = await puppeteer.launch({headless:true,args: ['--no-sandbox']})
            const page = await browser.newPage();
            for(i=0;i<products.length;i++){
                let result = await scrapeData(products[i].url,page)
                Product.updateOne({"url" : products[i].url},{$set:{'title': result.title,'newprice': result.price,'newstock': result.stock,'updatestatus':"Update"}})
                .then(product=>{})
            }
            browser.close()
        })
    } catch (error) {
        req.flash("error_msg","Error :"+error)
        res.redirect("/dashboard")
    }
});

//Delete routes started here
router.delete("/delete/product/:id",(req,res)=>{
    let searchQuery = {_id: req.params.id}
    Product.deleteOne(searchQuery)
    .then(product=>{
        req.flash("success_msg","Product Deleted Successfully")
        res.redirect("/dashboard")
    }).catch(error=>{
        req.flash("error_msg","Error :"+error)
        res.redirect("/dashboard")
    });
});

//Routes For Error or Page not Found
router.get("*",(req,res)=>{
    res.render("./admin/notfound")
})


module.exports = router;