/* URL SHORTENER MICROSERVICE
This server accepts a URL sent to '/shorten/' and returns a short URL. Going to the root directory + the short URL redirects to the long URL.
Based on a FreeCodeCamp challenge.
*/

// %%%%%%%%%% SERVER SETUP %%%%%%%%%%
var express = require('express'),
    bodyParser = require('body-parser'),
    mongoSanitize = require('express-mongo-sanitize'),
    helmet = require('helmet');

var app = express();
app.use(express.static('public'));
app.use(helmet());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// %%%%%%%%%% DATABASE SETUP %%%%%%%%%%
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var dbAddress = 'mongodb://' + process.env.DBUSER + ':' + process.env.DBPASSWORD + '@' + process.env.DBHOST + ':' + process.env.DBPORT + '/' + process.env.DB;

var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
mongoose.connect(dbAddress);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log('database connected!');
});

// %%%%%%%%%% SCHEMAS AND MODELS %%%%%%%%%%
var URLPairSchema = new mongoose.Schema({
  longURL: Array,
  shortURL: Array,
  tracker: Array
});
var URLPairModel = mongoose.model("URLPairModel", URLPairSchema);

var nextShortURLSchema = new mongoose.Schema({
  nextShortURL: Array
});
var nextShortURLModel = mongoose.model("nextShortURLModel", nextShortURLSchema);

/*
%%%%%%%%%% SHORT URL GENERATOR %%%%%%%%%%
The goal is to generate as short of a URL as possible. Also, each generated URL has to be unique.
We will use every character that is allowed in a URL, except some of the more confusing-looking "special characters", like commas.
*/

// List of possible characters:
var characters = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '!', '-', '+','(', ')', '*', '_', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

// keep track of the last-used short URL: (this will be an array)
var shortURL;

/* Uncomment this if you want to clear the db and start over
nextShortURLModel.remove({}, function (err, cont) {
  console.log('model cleared'); 
});
URLPairModel.remove({}, function (err, cont) {
  console.log('model cleared'); 
});
*/

// get the last-used short URL from the DB. There should always only be one entry, which we will update when we increment it:
nextShortURLModel.findOne(function (err, contents) {
  if (err) {
    console.log(err);
  } if (contents) {
    shortURL = contents.nextShortURL;
    console.log('server restarted, and shortURL was found in DB. It is:');
    console.log(shortURL);
    console.log(typeof(shortURL));
  } else {
    console.log('nextShortURL not found! Setting it to 0. This code should only ever run once...')
    let nextShortURL = new nextShortURLModel();
    nextShortURL.nextShortURL = ['0'];
    nextShortURL.save();
    shortURL = ['0'];
  };
}); 

// This function is called when someone sends a URL to be shortened. It generates the next short URL by incrementing the most recently generated URL:
var incrementURL = function() {
  // Now we increment the last-used short URL to make the next one.
  // go through the last-used short URL, starting from the right:
  for (var i=shortURL.length-1; i>=0; i--) {
    // if the current character is not Z (Z is last in the list):
    if (shortURL[i] != 'Z') {
      // change the current character to the next character in the character list:
      shortURL[i] = characters[characters.indexOf(shortURL[i])+1];
      // and we've done enough:
      break;
    }
    // if the current character is Z, but we aren't at the leftmost character yet:
    else if (i != 0) {
      // change the current character to 0 (0 is first in the list):
      shortURL[i] = '0';
      // now the loop will trigger i-- and start over, looking at the next character to the left.
    }
    // if neither of the above conditions triggered, then all the characters in the whole URL must be Z:
    else {
      // so start over with 0 for every character, and with one more character than before:
      var tempShortURL = ['0'];
      for (var i=1; i<=shortURL.length; i++) {
        tempShortURL.push('0');
      }
      shortURL = tempShortURL;
      console.log('new shorturl = ' +shortURL);
    }
  }
  console.log('shortURL has been incremented, and is now: ');
  console.log(shortURL);
  console.log(typeof(shortURL));
  // updates the database's record of the last given short URL:
  nextShortURLModel.update({}, {$set: {nextShortURL: shortURL}}, function(err, doc) {
    if (err) {
      console.error('could not find anything under nextShortURLModel in db');
  }});
};

// %%%%%%%%% ROUTING %%%%%%%%%%

/*
// for troubleshooting the database:
app.get('/getdb', (req, res) => {
  console.log('req received to /getdb');
  URLPairModel.find(function (err, contents) {
    if (err) return console.error(err);
    console.log('contents = ' + contents);
    res.send('<p>' + contents.join('</p><p>') + '</p>');
  })
})
*/

// index.html
app.get("/", function (request, response) {
  console.log('req to index.html received');
  response.sendFile(__dirname + '/views/index.html');
});

// Some chaacters cannot be passed to the database safely. Some of these are probably OK, but I wanted to be on the safe side:
var badChars = ['/', '$', ':', '.', ',', '\\', ';', '?', '@', '=', '&', '|', '~', '^', '[',']', '`', "'", '"', ' ']

// receives long URL through ajax data, creates shortened URL, stores them in DB as a pair, and returns shortened URL
app.post("/shorten", (req, res) => {
  var longURL = req.body.longURL;
  if (longURL=="favicon.ico") {
    return;
  };
      // we can't just run the user-input through URI encoding, because that may already have been done, so we wouldn't be able to return it to its original form. Instead, we will make a new array to track the changes we make:
      var tracker = [];
      longURL = longURL.split('');
      for (var i in longURL) {
        for (var j in badChars) {
          if (longURL[i] == badChars[j]) {
            tracker = tracker.concat( [[i, j]] );
            longURL[i] = 'x';
          }
        } 
      }
      // for example, if url starts with "http:", then (once it's an array) url[4] = : (colon), so we replace it with x
      // : is badChars[2], so we saved [4,2] at tracker[0].
  var URLPair = new URLPairModel({
    longURL:longURL,
    shortURL:shortURL,
    tracker:tracker
  });
  console.log('shorten request received. URLPair = ' + URLPair);
  URLPair.save();
  res.send(shortURL.join(''));
  incrementURL();
});

// Listens for people coming in at the short URL, and redirects them to the long URL
app.get('/:shortURL', function(req, res) {
  var URL = req.params.shortURL.split('');
  // $ and . run commands in the db, so we do not accept them:
  if (URL.includes('$' || '.')) {
    res.redirect('/');
    return;
  }
  console.log('get req recieved to ' + URL);
  // search db for the shorturl:
  URLPairModel.findOne({ 'shortURL': URL }, function(err, data) {
    if (data) {
      if (data.longURL && data.tracker) {
        var longURL = data.longURL;
        // MongoDB was returning tracker as an object i couldn't iterate through, so I convert to array
        var tracker = Array.from(data.tracker);
        /* tracker looks something like this: (1st number is position of the number that was x'd out in the url, 2nd number is badChar array index.)
        [ [ '4', '2' ],
        [ '5', '0' ],
        [ '6', '0' ],
        [ '10', '3' ],
        [ '17', '3' ] ]
         */
        // this code restores the url to its original content:
        for (var k in tracker) {
          longURL[tracker[k][0]] = badChars[tracker[k][1]];  
          console.log('trackerk = ' + tracker[k] + ', longurl... = ' +longURL[tracker[k][0]] + ', badchars... = '+ badChars[tracker[k][1]]);
        }
        longURL = longURL.join('');
        
        if (!longURL.startsWith('http://') && !longURL.startsWith('https://')) {
          longURL = 'http://' + longURL;
          console.log('added http://');
        }
        res.redirect(longURL);
        console.log('request received for shortURL= ' + URL + ', and was redirected to longURL= ' + longURL)
        return;
      }
    }
    else { 
      res.status(404).send('That does not match any stored link :(');
      console.log('request received for shortURL= ' + URL + ', but no matching longURL was found.');
    }
  })
});
 


/*
MongoClient.connect(dbAddress, function(err, db) {
  console.log('db attempted...');
  if (err) {
    console.log('Unable to connect to the mongoDB server. Error:', err);
  } else {
    console.log('Connection established with database.');
    db=db;
    
    
    
    app.get("/:URL", (req, res) => {
      var URL = req.params.URL;
      console.log('Get request received, with params: ' + URL);
      db.collection('longURLs').save(URL, (err, result) => {
        if (err) return console.log(err);
        console.log('saved this URL to db: ' + URL);
        res.redirect('/');
      });
    });
    
    
    db.close();
  }
})
*/


// http://expressjs.com/en/starter/basic-routing.html
/*


app.get("/dreams", function (request, response) {
  response.send(dreams);
});

// could also use the POST body instead of query string: http://expressjs.com/en/api.html#req.body
app.post("/dreams", function (request, response) {
  dreams.push(request.query.dream);
  response.sendStatus(200);
});

// Simple in-memory store for now
var dreams = [
  "Find and count some sheep",
  "Climb a really tall mountain",
  "Wash the dishes"
];
*/
// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
