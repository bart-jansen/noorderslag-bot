var builder = require("botbuilder");
var _ = require('lodash');
var Matcher = require('did-you-mean');


module.exports = function (lineup) {
  var genres = [];
  lineup.acts.forEach(function(act) {
    genres = genres.concat(act.tagLabels);
  });
  genres = _.filter(_.uniq(genres), label => label !== null);

  var m = new Matcher({values: genres,threshold: 6});

  return function(session, args, next) {
    var genre = builder.EntityRecognizer.findEntity(args.entities, 'genre');
    session.sendTyping();
    var foundActs = _.filter(lineup.acts, function (act) {
      if (act.tagLabels && act.tagLabels.indexOf(m.get(genre.entity)) >= 0) {
        return act;
      }
      return null;
    });
    var cards = createGenreCards(session, foundActs); // create the cards
    var reply = new builder.Message(session)
        .attachmentLayout(builder.AttachmentLayout.carousel)
        .attachments(cards);
    session.send(reply); // off you go, weather cards!
  }
}

function createGenreCards(session, acts) {
    var cards = [];
    _.forEach(acts, function(act) {
      cards.push(new builder.HeroCard(session)
        .title(act.title)
        .subtitle(act.tagLabels.join(' - '))
        .images([builder.CardImage.create(session, act.img)])
        .buttons([builder.CardAction.openUrl(session, 'https://www.eurosonic-noorderslag.nl' + act.url, 'View more details')])
      );
    });

    return cards;
}
