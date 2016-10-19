//
// The !cloc command.  Runs the cloc tool on the source, and reports a friendly string
// with the lines of code counted.
//

module.exports = {
   name: 'cloc',
   args: '',

   init: function (chatter, config, strings, bot) {

      this.help = strings.get ('help-cloc');

      bot.on( 'command!cloc', function (channel, text, nickname, stanza) {
         // Run the cloc command on the source code and report the results
         var exec = require ('child_process').exec;
         var command = config ['cloc-command'];
         if (!command) {
            command = 'cloc --exclude-dir=node_modules,frameworks --exclude-lang=CMake --progress-rate=0 --csv --quiet ' + __dirname;
         }
         console.log ("Running the cloc command");
         console.log (command);
         exec (command, function (error, stdout, stderr) {

            if (error) {
               bot.message (channel, 'I\'m afraid there was an error with the !cloc command.');
               console.log (error);
            } else {
               // The cloc command returns CSV like so:
               // files,language,blank,comment,code,"http://cloc.sourceforge.net v 1.60  T=0.05 s (38.1 files/s, 4226.8 lines/s)"
               // 2,Javascript,28,26,168
               try {
                  var lines = stdout.split ('\n');

                  var totals = {
                     "sum": 0
                  };
                  for (var i = 0; i < lines.length - 1; i++) {
                     var line = lines [i];
                     if (line && line.length > 0) {
                        var spl = line.split (',');
                        var s = parseInt (spl [4]);
                        if (!isNaN (s)) {
                           totals [spl [1]] = s;
                           totals ["sum"] += s;
                        }
                     }
                  }

                  var message = "The project is currently " + totals ["sum"] + " lines of code.";
                  bot.message (channel, message);
               } catch (ex) {
                  console.log (ex);
               }
            }
         });
      });
   }
};



