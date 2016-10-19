# code-stream-guard

A Chat Bot for Live Coding Streamers

# Inspiration

- https://github.com/LiveCodeMonkeys/lctvbot_module
- https://gist.github.com/powdahound/940969
- https://github.com/Cristy94/livecoding-chat-bot

# Aim

To provide a chat bot that will offer features to live code streamers, such
as those on livecoding.tv and the twitch.tv Creative channels.  Currently only
livecoding.tv is supported, using the XMPP chat connection.

# Features

* Connect to livecoding.tv chat channels
* Welcome new viewers in the chat
* Provides a transparent stream overlay window for notifications
* Displays a popup welcome avatar image for viewers joining
* Displays a popup welcome avatar image for new followers including a shower of fireworks
* Displays a popup animation when someone submits a rating
* Provides the following chat bot commmands:
..* !help
..* !cloc - Count lines of code
..* !rate N - Rate the streamer between 0 and 100
* Separate strings.json file for message customisation
* Followers and ratings saved to json files between sessions

# TODO

* Clean up the window setup from new, postion and transparency are awkward
* Add sound effects
* Add more chat commands
* Allow multiple front end connections (for indicator lights or other hardware)

# Usage

Currently, the code has only been tested on Mac OS.  It should run on Linux, but
I have had trouble with transparency on the front end UI window (from Node Webkit).

You will need to make your own config.json file, which you can go by copying
example-config.json and editing it.  You need to make sure the values are set
as described below.

```

$ npm install
$ cp example-config.json config.json

... Edit config.json with your details ...

$ ./run
```

This runs the bot using [NW.js](https://nwjs.io/ "NW.js Homepage"), see below for more details.

You can also use:

```
$ node app
```
but this will not open up the frontend UI window.  However, you can open a web browser pointing
to http://localhost:3000 in order to get the UI notifications.

# Node Webkit (NW.js) Integration

If run using the [Node Webkit](https://nwjs.io/ "NW.js Homepage") integration (./run), you should
get a window open up on screen, which loads the index.html page.  This window contains 2 areas
that are used to notify the streamer of people joining and leaving the chat channel, new
followers, and also new ratings using the !rate command.  By default, the window opens up without
transparency, in the middle of the screen.  It should be possible to move this window to somewhere
appropriate on the screen, or indeed offscreen to a second monitor then close the window.  Then
restart the app and the window will appear in the place it was left.

Once the window is in the correct place, you can edit the package.json file and set the
following values:

``` json
{
   "window": {
      "resizable": false,
      "frame": false,
      "transparent": true
   }
}
```

In order for the window to be transparent, you need to set this values.  Also, see
[this page](https://github.com/nwjs/nw.js/wiki/Transparency) for more details.

Once the window is transparent, and off to one side or a second monitor, you can
add it to your stream using OBS Window Capture source.  Being transparent, you
can put it where you like and the animations will appear when something happens.

# config.json

``` json
{
   "livecoding.tv": {
      "domain": "chat.livecoding.tv",
      "channel": "longsteve",
      "nickname": "my_bot@livecoding.tv",
      "password": "PASSWORD",
      "chatname": "Tim",
      "owner": "Steve",
      "followers-feed-url": "https://www.livecoding.tv/rss/longsteve/followers/?key=FEEDKEY",
      "cloc-command": "cloc --exclude-dir=node_modules,frameworks --exclude-lang=CMake --progress-rate=0 --csv --quiet /Users/USERNAME/Projects/PROJECT"
   }
}
```
* **domain** needs to be left as *chat.livecoding.tv*
* **channel** is the channel that the bot will join. This is normally going to be the username (without @livecoding.tv) of the streamer. I've used *test* before, and I think my bot joined the channel of a livecoding.tv user called *test*!
* **nickname** is the full @livecoding.tv username of the user the bot is going to log in as.  You need to create a proper user to identify to the chat service as.
* **password** is the password of the chat bot user identified by *nickname*.  Note this is not the password of the streamer.
* **chatname** is the name by which the bot refers to itself in it's message strings. For example, the default greeting when it joins a channel is "Hi everyone. I'm {name} the chat bot", and {name} gets replaced with the *chatname* config value.
* **owner** is the name by which the chat bot refers to the channel owner.  eg. "{name}'s new rating is 100%"
* **followers-feed-url** is the url that can be used to get all the channel owner (streamers) followers. You get this by going to your **Follows** profile page when logged into livecoding.tv and clicking on the RSS icon.  The bot uses this value to check for new followers.
* **cloc-command** is run when someone enters **!cloc** in the chat window.  It needs to be formated like the example, because the code in cloc.js uses the csv format.    The example ignores node_modules/ and frameworks/ folders to speed up the command, you just need to put in an appropriate project folder.  Also make sure cloc is installed.
