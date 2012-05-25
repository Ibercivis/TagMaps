var boxes = '-18.16,27.63,-13.4,30.0,-7.523,36.0,-1.6274,38.7289,-7.5416,37.35,4.33,40.48,-7.08,40.48,4.33,41.807,-9.3,41.807,-0.73,43.8,-0.73,41.807,3.34,43.0,-2.9755,35.2560,-2.91,35.337,-5.3822,35.8715,-5.2783,35.9180';

var keywords = 'unizar,@unizar,#unizar,zaragoza,bifi,ibercivis,iberus,chema gimeno,manolo lopez,universidad de zaragoza';
var users = '';

var util = require('util');
var twitter = require('immortal-ntwitter');
var fs = require('fs');
var orient = require("orientdb"),
     Db = orient.Db,
     Server = orient.Server;

var dbConfig = {
    user_name: "admin",
    user_password: "admin",
};
var serverConfig = {
    host: "localhost",
    port: 2424,
    user_name: "root",
    user_password: "208812227EDB54ACFCB55B8D7FF9ABA0B8B4526F7B3276A3F4360DA26BD6E4E9"
};

var server = new Server(serverConfig);
var db = new Db("../databases/twzaragoza",server,dbConfig);
//al que se le ocurrio que Uppercase/Lowercase era una buena manera de
//distinguir variables, tendrian que colgarlo -- AR


var tweet = twitter.create({
    consumer_key: 'HGHEHwZIdy9U72xERlZQ',
    consumer_secret: 'uBBpzMKtKS6xK4zCNHCRk8vs0qQ1jtEeLyS1bqti8',
    access_token_key: '250090286-bYaAOcA557DnGhs8KjlkGJwUnBcZB6B4McHC6AMd',
    access_token_secret: 'CmHOuzo5wuBXrh3NIs1BQw0l8l9R6sOdiFMf1vBJU'
});

//tweet.stream('statuses/filter', {'locations': boxes}, function(stream) {
//     stream.on('data', function(data) {
// 	console.log('@' + data.user.screen_name + ' : ' + data.text);
//     });
// });
var my_file = fs.openSync('stream_unizar.log', 'a');

db.open(function(err,result){
  tweet.stream('statuses/filter', {'track': keywords}, function(stream) {
    stream.on('data', function(data) {
	fs.writeSync(my_file, JSON.stringify(data), null);
	fs.writeSync(my_file, '\n', null);
	fs.fsyncSync(my_file);
        data["@class"]="patata";
        db.save(data, function(err, data) {
          if (err) { 
             console.log("db fail "+ err);
          } else {
          console.log("result:"+data["@rid"])
          }
        });
    });
  });
});
