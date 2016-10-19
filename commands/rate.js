//
// The !rate command.  Accepts a value between 0 and 100, stores the rating the user gives,
// then calculates an average.
//

var _ = require ('lodash');

var jsonfile = require ('jsonfile');

// Load the currently known ratings from the json file
var jsonFilename = __dirname + '/../saved/ratings.json';

module.exports = {
   name: 'rate',
   args: 'N',
   init: function (chatter, config, strings, bot) {

      this.help = strings.get ('help-rate', {'owner': config ['owner']});

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
                  message = strings.get ('rate-0-currently', {'owner': config ['owner']});
               } else {
                  var total = _.sum(_.values(ratings));
                  var rating = Math.ceil (total / count);
                  message = strings.get (count === 1 ? 'rate-1-currently' : 'rate-n-currently', {
                     'owner': config ['owner'],
                     'pct': rating,
                     'num': count
                  });

                  chatter.emit ('rating', {
                     'nickname': nickname,
                     'rating': rating,
                     'message': message
                  });
               }
            } else {
               // Some text entered
               try {
                  var r = parseInt (text);
                  if (isNaN (r)) {
                     throw new Exception ("NaN");
                  }

                  if (r > 100) {

                     var chat_msg = strings.get ('rate-gt-100', {
                        'name': nickname
                     });
                     bot.message (channel, chat_msg);

                  } else if (r < 0) {

                     var chat_msg = strings.get ('rate-lt-0', {
                        'name': nickname
                     });
                     bot.message (channel, chat_msg);

                  } else {

                     // We have a real number between 0 and 100

                     ratings[nickname] = r;

                     var count = _.size (ratings);
                     var total = _.sum(_.values(ratings));
                     var rating = Math.ceil (total / count);

                     var chat_msg = strings.get ('rate-thanks', {
                        'name': nickname,
                        'owner': config ['owner']
                     });
                     bot.message (channel, chat_msg);

                     // Emit the new rating event
                     chatter.emit ('rating', {
                        'nickname': nickname,
                        'value': r,
                        'rating': rating
                     });

                     message = strings.get (count === 1 ? 'rate-1-new' : 'rate-n-new', {
                        'owner': config ['owner'],
                        'pct': rating,
                        'num': count
                     });

                     jsonfile.writeFile (jsonFilename, ratings, function wroteJsonRatingsFile () {
                        console.log ("ratings.json written");
                     });
                  }
               } catch (ex) {
                  message = strings.get ('rate-error');
               }
            }

            bot.message (channel, message);
         });
      });
   }
};

