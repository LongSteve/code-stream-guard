//
// RSS Feed reader for the followers.  Checks every 15 seconds while the app is running.
//

var _ = require ('lodash');

var winston = require ('winston');

var util = require ('util');
var request = require ('request');
var schedule = require ('node-schedule');

var __approot = require('app-root-path');

var config = require (__approot + '/modules/config.js');

var FeedParser = require ('feedparser');

var EventEmitter = require ('events').EventEmitter;

//
// Followers are saved in a json file
//
var jsonfile = require ('jsonfile');

// Load the currently known followers list from the json file
var jsonFilename = __approot + '/saved/followers.json';

var Followers = function Followers () {
   var self = this;

   var lastFollower = null;
   var allFollowers = {};

   var processing = false;

   var fetch = function fetch () {

      if (processing) {
         console.log ("Already processing feed");
         return;
      }

      processing = true;

      winston.silly ("Fetching and processing followers feed");

      // Request the followers feed URL
      var req = request (config ['followers-feed-url']);
      var feedparser = new FeedParser ();

      var followers = [];

      req.on ('error', function (error) {
        // handle any request errors (couldn't download the feed from the URL for example
        winston.error ("Error requesting feed URL: " + error);
        processing = false;
      });

      req.on ('response', function (res) {
        var stream = this;

        if (res.statusCode != 200) {
           winston.error ("Error response code from feed: " + res.statusCode);
           return this.emit ('error', new Error('Bad status code'));
        }

        stream.pipe (feedparser);
      });

      feedparser.on ('error', function (error) {
        // always handle errors
        winston.error ("Error processing the feed data: " + error);
        processing = false;
      });

      feedparser.on ('end', function () {
         jsonfile.readFile (jsonFilename, function readJsonFollowersFile (error, saved_followers) {
            if (error) {
               winston.warn ("Error reading followers.json (assuming no followers): " + error);
            }

            saved_followers = saved_followers || [ ];

            // Are any of the entries in followers new
            var joined_since = _.difference (followers, _.map (saved_followers, "name"));
            if (joined_since.length > 0) {
               _.each (joined_since, function (follower) {
                  saved_followers.push ({
                     name: follower,
                     date: new Date
                  });
               });

               self.emit ('followed', joined_since);
            }

            // If anyone is in saved_followers, but not followers, then they un-followed
            var unfollowed = _.difference (_.map (saved_followers, "name"), followers);
            if (unfollowed.length > 0) {
               _.pullAllWith (saved_followers, unfollowed, function (arrVal, othVal) {
                  return (arrVal.name === othVal);
               });
               self.emit ('unfollowed', unfollowed);
            }

            // Anything changed?
            if (joined_since.length + unfollowed.length > 0) {
               // Save the current set of followers
               jsonfile.writeFile (jsonFilename, saved_followers, function wroteJsonFollowersFile () {
                  winston.silly ("followers.json written");
                  processing = false;
               });
            } else {
               // Nothing has happened
               processing = false;
            }

            // Remember the last follower
            lastFollower = _.maxBy (saved_followers, 'date');

            // Store a map of all followers
            allFollowers = _.chain (saved_followers).keyBy (function (o) {
               return _.toLower (o.name);
            }).value ();
         });
      });

      feedparser.on ('readable', function () {

         // This is where the action is!
         var stream = this;
         var item;

         while (item = stream.read ()) {
           followers.push (item.title);
         }
      });
   }

   winston.info ("Fetching current followers feed.");
   fetch ();

   winston.info ("Scheduling feed job for every 30 seconds.");
   var job = schedule.scheduleJob ('*/30 * * * * *', fetch);

   self.lastFollower = function () {
      return lastFollower;
   };

   self.numFollowers = function (numFollowers) {
      return Object.keys (allFollowers).length;
   };

   self.getFollowers = function () {
      return Object.keys (allFollowers);
   };

   self.isFollower = function (follower) {
      return (allFollowers [follower] !== undefined);
   };
};

util.inherits (Followers, EventEmitter);

module.exports = exports = new Followers ();
