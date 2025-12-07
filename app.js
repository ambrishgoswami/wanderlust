if (process.env.NODE_ENV != "production") {
    require("dotenv").config();
} 

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path"); 
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate"); 
const ExpressError = require("./utils/ExpressError.js");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

// Check if MONGO_URL exists
const dbUrl = process.env.MONGO_URL;

if (!dbUrl) {
    console.error("❌ MONGO_URL environment variable is not defined!");
    process.exit(1);
}

console.log("🔄 Connecting to MongoDB...");

// MongoDB Connection with better error handling
mongoose.connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
})
.then(() => {
    console.log("✅ Connected to MongoDB Atlas successfully!");
})
.catch((err) => {
    console.error("❌ MongoDB Connection Error:");
    console.error("Error Message:", err.message);
    console.error("Error Code:", err.code);
    
    if (err.code === 'ENOTFOUND') {
        console.error("🔍 DNS resolution failed. Possible issues:");
        console.error("  - Check if MongoDB Atlas cluster is running");
        console.error("  - Verify connection string is correct");
        console.error("  - Check Network Access whitelist in MongoDB Atlas");
    }
    
    // Don't exit immediately in production, retry connection
    if (process.env.NODE_ENV === "production") {
        console.log("🔄 Retrying connection in 5 seconds...");
        setTimeout(() => {
            mongoose.connect(dbUrl);
        }, 5000);
    } else {
        process.exit(1);
    }
});

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
    console.log('📡 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('📴 Mongoose disconnected from MongoDB');
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")) 
app.use(express.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const store = MongoStore.create({
    mongoUrl: dbUrl, 
    crypto : {
        secret: process.env.SECRET || "defaultsecretkey",
    },
    touchAfter: 24 * 3600, 
});

store.on("error", (err) => {
    console.log("❌ ERROR in MONGO SESSION STORE:", err);
});

const sessionOptions = {
    store,
    secret: process.env.SECRET || "defaultsecretkey",
    resave: false, 
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    }
};

app.use(session(sessionOptions));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

app.get('/', (req, res) => {
    res.redirect('/listings');
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

app.all("*", (req, res, next) => {
    next(new ExpressError(404, "Page not found!!"));
}); 

app.use((err, req, res, next) => {
    let {statusCode=500, message="something went wrong"} = err;
    res.status(statusCode).send(message);
}); 

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 Server is listening on port ${PORT}`);
});
