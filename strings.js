//
// A strings module, that reads all user facing strings from a strings.json
// file, and provides a replace function for {inserts}.  Useful if anyone
// wants to translate the strings to a different language, or change them
// for their own purposes.
//

function Strings () {
}

Strings.prototype.init = function init () {
   var self = this;

   var strings = require ('./strings.json');

   self.get = function getString (id, inserts) {
      if (!id) {
         return;
      }
      inserts = inserts || {};

      var str = new String (strings[id]);
      if (str) {
         for (var ins in inserts) {
            if (inserts.hasOwnProperty (ins)) {
               var regex = new RegExp ('{'+ins+'}', 'g');
               str = str.replace (regex, inserts [ins]);
            }
         }
      }
      return str;
   };
};

module.exports = exports = new Strings ();
