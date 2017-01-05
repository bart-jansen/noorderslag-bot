// initialize
var fs = require("fs");
var didYouMean = require('didyoumean');

var days = ['wednesday', 'thursday', 'friday', 'saturday'];

var events = [];
days.forEach(function(day) {
     var dayContents = fs.readFileSync(__dirname + '/data/'+day+'.json');
     var dayJSON = JSON.parse(dayContents)[0];

     dayJSON.locations.forEach(function(loc) {
        loc.events.forEach(function(event) {
            events.push(event);
        });
    });
});

function getArtist(artistName) {
    didYouMean.returnWinningObject = true;
    return  didYouMean(artistName, events, 'description');
}

module.exports = getArtist;
