//
// The !rate command.  Accepts a value between 0 and 5, and stores the rating the user gives,
// then calculates an average.
//

var _ = require ('lodash');

var jsonfile = require ('jsonfile');

// Load the currently known ratings from the json file
var jsonFilename = __dirname + '/../ratings.json';

module.exports = {
   name: 'rate',
   args: 'N',
   help: 'Rate Steve (0-5)',
   init: function (chatter, bot) {

      jsonfile.readFile (jsonFilename, function readJsonRatingsFile (error, ratings) {
         if (error) {
            console.log ("Error reading ratings.json (assuming it's empty): " + error);
         }

         ratings = ratings || {};

         bot.on( 'command!rate', function (channel, text, nickname, stanza) {
            var message;
            if (!text || !text.trim ()) {
               var count = _.size (ratings);
               if (count === 0) {
                  message = "Steve's rating is currently 0.0/5.0,\nnobody has submitted a rating yet!";
               } else {
                  var total = _.sum(_.values(ratings));
                  var rating = total / count;
                  message = "Steve's rating is currently " + rating.toFixed (1) + "/5.0,\n" + count + " viewer" + ((count > 1) ? "s have " : " has ") + "rated so far.";
               }
            } else {
               try {
                  var r = parseInt (text);
                  if (isNaN (r)) {
                     throw new Exception ("NaN");
                  }
                  if (r > 5) {
                     r = 5.0;
                  }
                  if (r < 0) {
                     r = 0.0;
                  }
                  ratings[nickname] = r;

                  var count = _.size (ratings);
                  var total = _.sum(_.values(ratings));
                  var rating = total / count;

                  bot.message (channel, "Thanks " + nickname + " Steve really appreciates the feedback.");

                  message = "Steve's new rating is " + rating.toFixed (1) + "/5.0,\n" + count + " viewer" + ((count > 1) ? "s have " : " has ") + "rated so far.";

                  jsonfile.writeFile (jsonFilename, ratings, function wroteJsonRatingsFile () {
                     //console.log ("ratings.json written");
                  });

               } catch (ex) {
                  message = "You need to supply a number between 0 and 5 to the !rate command.";
               }
            }

            bot.message (channel, message);
         });
      });
   }
};

