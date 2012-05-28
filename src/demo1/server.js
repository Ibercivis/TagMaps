var boxes = '-18.16,27.63,-13.4,30.0,-7.523,36.0,-1.6274,38.7289,-7.5416,37.35,4.33,40.48,-7.08,40.48,4.33,41.807,-9.3,41.807,-0.73,43.8,-0.73,41.807,3.34,43.0,-2.9755,35.2560,-2.91,35.337,-5.3822,35.8715,-5.2783,35.9180';

var keywords = 'unizar,@unizar,#unizar,zaragoza,bifi,ibercivis,iberus,chema gimeno,manolo lopez,universidad de zaragoza';
var users = '';

var asincrono=require('async');
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
//distinguir variables y creadores, tendrian que colgarlo -- AR


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
//var my_file = fs.openSync('stream_unizar.log', 'a');



function comprueba(tableclass, id, callback) {
   db.command("SELECT FROM "+tableclass+" where id = "+id, function(err,results) {
      if (results.length) == 0 {
         callback(); //null result
      }
      else {
         callback(results[0]["@rid"]);  //o es 1??
      } 
   }
}



function savePlace(place,callback) {
  //comprueba que no existe el id; si existe devuelve el rid
  comprueba("lugar",place.id,hold.method)
  callback(null,rid) 
}

function saveAuthor(authordata,callback) {
  //comprueba que no existe el id; si existe devuelve el rid

  comprueba("usuario",author.id,hold.method)
  callback(null,rid);//no error, devolvemos el rid
}


function createEdges(tweetRid, entities) {
  //TO DO NEXT
  //de momento solo hashtags. Podemos hacer un
  //for key en entities, y considerarlos todos
  //de la misma clase, o hacer un caso
  //especial con mentions, que pueden ser authors o no
}


function saveTweet(data,callback) {

  if !(this.ok) { //nos llaman sin ser objeto, nos objetivamos
                  //en la verificacion
      var hold={}
      hold.data=data
      hold.method=saveTweet
      hold.callback=callback
      hold.ok=true
      comprueba("mensaje",data.id,hold.method)
      return 
  }
 
  //nos llaman como objeto 
  callback=this.callback;
  if (data){ //ya hay un rid, en data!
       callback(null,data)
       return
    }
     
  //no hay rid, es todo nuevo
  data=this.data
  
  var sustituciones={};
  //sustituye autor 
     sustituciones.user= function(callback){
       saveAuthor(data.user, callback);
     });
  //sustituye place si lo hay
    if (data.place) {
      sustituciones.place= function(callback){
       savePlace(data.place, callback);
     });
    }
  //sustituye retuit si lo hay (esto es recursivo)
    if (data.place) {
      sustituciones.retweeted_status=function(callback){
       saveTweet(data.retweeted_status, callback);
     });
    }
  
  asincrono.parallel(sustituciones, function(err,results) {
     if (err) {
       console.log("fallo el paralelo "+err)
     } else {
        //acepta rids, graba dato ... 
        for (key in results) {
          data[key]=results[key]; 
        }
        data["@class"]="mensaje";
          //TO DO: la fecha, vale tal como esta?
        db.save(data, function(err, data) {
           if (err) {
              console.log("db fail "+ err);
           } else {
              console.log("result:"+data["@rid"]);
              // ... y crea entidades; lo hacemos aqui por si hay llamadas recursivas a saveTweet 
              createEdges(data["@rid"], data["entities"]);
              // TO DO: podriamos plantearnos Edges especiales:
              //     if (in_reply_to_status_id) ...
              //     if (in_reply_to_user_id) ....
              //     if (retweeted_status) ....
              callback(null,data["@rid"]);
              return;
           }
        });
      }
  });
  // si llegamos aqui, mal vamos
  callback("some error has happened");
}



db.open(function(err,result){
  tweet.stream('statuses/filter', {'track': keywords}, function(stream) {
    stream.on('data', function(data) {
//	fs.writeSync(my_file, JSON.stringify(data), null);
//	fs.writeSync(my_file, '\n', null);
//	fs.fsyncSync(my_file);
        saveTweet(data,console.log);  
    });
  });
});
