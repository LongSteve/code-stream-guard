//
// A module to retrieve the avatar image for a livecoding.tv follower
//

//
// Use as follows:
// var Avatar = require ('./avatar.js');
// var av = new Avatar ();
// av.requestImage ('longsteve', function requestImageCallback (error, image_url) {
//    ... do something with the image url ...
// });
//

var _ = require ('lodash');

var request = require ('request');
var cheerio = require('cheerio');

var Avatar = function Avatar () {
   var self = this;

   self.requestImage = function requestImage (username, callback) {
      var url = 'https://livecoding.tv/' + username.toLowerCase () + '/profile';
      request (url, function (error, response, html) {

         // Default avatar image in case anything goes wrong
         var avatar_url = 'https://www.livecoding.tv/static/img/userdashboard-img.png';

         if (error) {
            console.log ("Error retrieving profile: " + error);
            if (typeof callback === 'function') {
               callback (error, avatar_url);
            }
            return;
         }

         $ = cheerio.load (html);

         // Get the img tag underneath the .social-avatar div
         var return_url = $ ('.social-avatar img').attr ('src');
         if (return_url) {
            if (return_url.indexOf ('http') === -1) {
               return_url = 'https://www.livecoding.tv' + return_url;
            }
         } else {
            // Return the static default image if we can't get the profile
            return_url = avatar_url;
         }
         if (typeof callback === 'function') {
            callback (null, return_url);
         }
      });
   };
};

module.exports = exports = Avatar;

