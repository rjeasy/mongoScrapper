// Dependencies
var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
// Requiring our Note and Article models
var Note = require("./models/Note.js");
var Article = require("./models/Article.js");
// Our scraping tools
var request = require("request");
var cheerio = require("cheerio");
// Set mongoose to leverage built in JavaScript ES6 Promises
mongoose.Promise = Promise;


// Initialize Express
var app = express();

// Use morgan and body parser with our app
app.use(logger("dev"));
app.use(bodyParser.urlencoded({
  extended: false
}));

// Make public a static dir
app.use(express.static("public"));

// Database configuration with mongoose



var MONGODB_URI = process.env.MONGODB_URI || "https://mongoswebcraper.herokuapp.com/heroku_b1x2pldp";

mongoose.connect(MONGODB_URI);

var db = mongoose.connection;

// Show any mongoose errors
db.on("error", function (error) {
  console.log("Mongoose Error: ", error);
});

// Once logged in to the db through mongoose, log a success message
db.once("openUri", function () {
  console.log("Mongoose connection successful.");
});


// Routes
// ======

// A GET request to scrape the website
app.get("/scrape", function (req, res) {
  // First, we grab the body of the html with request
  request("http://www.digg.com", function (error, response, html) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(html);
    // Now, we grab every h2 within an article tag, and do the following:
    $(".digg-story__content").each(function (i, element) {
      let newArticle = {};
      newArticle.title = $(element)
        .children(".digg-story__header")
        .children(".digg-story__title")
        .children(".digg-story__title-link")
        .text()
        .trim();
      console.log(element);

      newArticle.note = $(element)
        .children(".digg-story__description")
        .text()
        .trim();
      newArticle.link = $(element)
        .children(".digg-story__header")
        .children(".digg-story__title")
        .children(".digg-story__title-link")
        .attr("href")
        .trim();
      newArticle.saved = false;
    });
    // Tell the browser that we finished scraping the text
    res.send("Scrape Complete");
  });

  // This will get the articles we scraped from the mongoDB
  app.get("/articles", function (req, res) {
    // Grab every doc in the Articles array
    Article.find({}, function (error, doc) {
      // Log any errors
      if (error) {
        console.log(error);
      }
      // Or send the doc to the browser as a json object
      else {
        res.json(doc);
      }
    });
  });

  // Grab an article by it's ObjectId
  app.get("/articles/:id", function (req, res) {
    // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
    Article.findOne({ "_id": req.params.id })
      // ..and populate all of the notes associated with it
      .populate("note")
      // now, execute our query
      .exec(function (error, doc) {
        // Log any errors
        if (error) {
          console.log(error);
        }
        // Otherwise, send the doc to the browser as a json object
        else {
          res.json(doc);
        }
      });
  });


  // Create a new note or replace an existing note
  app.post("/articles/:id", function (req, res) {
    // Create a new note and pass the req.body to the entry
    var newNote = new Note(req.body);

    // And save the new note the db
    newNote.save(function (error, doc) {
      // Log any errors
      if (error) {
        console.log(error);
      }
      // Otherwise
      else {
        // Use the article id to find and update it's note
        Article.findOneAndUpdate({ "_id": req.params.id }, { "note": doc._id })
          // Execute the above query
          .exec(function (err, doc) {
            // Log any errors
            if (err) {
              console.log(err);
            }
            else {
              // Or send the document to the browser
              res.send(doc);
            }
          });
      }
    });
  });
});


