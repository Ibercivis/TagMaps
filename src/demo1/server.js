var boxes = '-18.16,27.63,-13.4,30.0,-7.523,36.0,-1.6274,38.7289,-7.5416,37.35,4.33,40.48,-7.08,40.48,4.33,41.807,-9.3,41.807,-0.73,43.8,-0.73,41.807,3.34,43.0,-2.9755,35.2560,-2.91,35.337,-5.3822,35.8715,-5.2783,35.9180';

var keywords = 'unizar,@unizar,#unizar,zaragoza,bifi,ibercivis,iberus,chema gimeno,manolo lopez,universidad de zaragoza';
var users = '';

// LA BBDD USA:
//create class mensaje extends OGraphVertex;
//create class usuario extends OGraphVertex;
//create class lugar extends OGraphVertex;  
//create class hashtag extends OGraphVertex;     
//
//create property hashtag.name string;
//create index nameidx on hashtag(name) dictionary; //no funciona :-( Admite duplicados.
//create index uniqname on hashtag(name) unique;



var asincrono = require('async');
var util = require('util');
var twitter = require('immortal-ntwitter');
var fs = require('fs');
var orient = require("orientdb");
var Db = orient.Db;
var graphDb=orient.GraphDb;
var Server = orient.Server;

var dbConfig = {
    user_name: "admin",
    user_password: "admin"
};

var serverConfig = {
    host: "localhost",
    port: 2424,
    user_name: "root",
    user_password: "208812227EDB54ACFCB55B8D7FF9ABA0B8B4526F7B3276A3F4360DA26BD6E4E9"
};

var server = new Server(serverConfig);
var db = new graphDb("../databases/twzaragoza", server, dbConfig);
//al que se le ocurrio que Uppercase/Lowercase era una buena manera de
//distinguir variables y creadores, tendrian que colgarlo -- AR


var tweet = twitter.create({
    consumer_key: 'HGHEHwZIdy9U72xERlZQ',
    consumer_secret: 'uBBpzMKtKS6xK4zCNHCRk8vs0qQ1jtEeLyS1bqti8',
    access_token_key: '250090286-bYaAOcA557DnGhs8KjlkGJwUnBcZB6B4McHC6AMd',
    access_token_secret: 'CmHOuzo5wuBXrh3NIs1BQw0l8l9R6sOdiFMf1vBJU'
});

//var my_file = fs.openSync('stream_unizar.log', 'a');


function comprueba(tableclass, id, callbackObj) {
    db.command("SELECT FROM " + tableclass + " where id = " + id, function(err,results) {
	if (results.length == 0) {
            callbackObj.final()
	} else {
            callbackObj.final(results[0]["@rid"]);  //o es 1??
	} 
    });
}

function Holder(tipo,savemethod,finalcallback,data){
	this.origdata = data;
        //console.log("Holder:"+this.constructor.name);
        //console.log(JSON.stringify(data));
        console.log("Holder - dataid ="+data.id); 
	this.final= savemethod;  // parece que no hace falta pero es el alma de la fiesta
	this.callback=finalcallback;
	comprueba(tipo,data.id,this);
}

function savePlace(placedata, finalcall) {
    console.log("savePlace as "+this.constructor.name);
    //comprueba que no existe el id; si existe devuelve el rid
        if (this.constructor != Holder) { //nos llaman sin contenedor
	var hold = new Holder("lugar",savePlace,finalcall,placedata)
	return null;
    }
 
    //nos llaman como objeto 
    callback = this.callback; // no es automatico? Igual no.
    if (plecedata){ //comprueba() ha puesto un rid en data
	callback(null, placedata);
	return null;
    }
     
    //no hay rid, es todo nuevo 
    // this.origdata
    
    //TO DO: save place
    
    callback(null, rid);
}

function saveAuthor(authordata, finalcall) {
    console.log("saveAuthor as "+this.constructor.name);
    //comprueba que no existe el id; si existe devuelve el rid
        if (this.constructor != Holder) { //nos llaman sin contenedor
	var hold = new Holder("usuario",saveAuthor,finalcall,authordata)
	return null;
    }
 
    //nos llaman como objeto 
    callback = this.callback; // hay un with automatico para this o no? 
    if (authordata){ //comprueba() ha puesto un rid en data
	callback(null, authordata);
	return null;
    }
     
    //no hay rid, es todo nuevo
    data = this.origdata;
    data ["@class"]="usuario";
    // TO DO: usuario podria tener lugares nuevos, que habria que verificar con savePlace
    db.save(data, function(err, data) {
		if (err) {
		    console.log("db author fail "+ err);
                    callback(err,-1);
		} else {
		    console.log("user result:"+data["@rid"]);
		    callback(null,data["@rid"]);
		}
           }); 
}




function saveLink(fromData,htItem,cbIter) { //fromData, text) {
  var text = htItem.text;
  //Como no hay un insert ignore hay que asegurarse bien. Por variar
  //de tema, vamos a hacerlo con waterfall.
  console.log ("try to save from "+fromData["@rid"]+ " to "+ text);
  asincrono.waterfall([
    function(cb){
        console.log ("SELECT FROM hashtag where name = '" + text +"'");
        db.command("SELECT FROM hashtag where name = '" + text +"'", function(err,results) {
            if (results.length == 0) {
              cb(null,null);
            }      else {
              cb(null,results[0]); 
            }
           }
        );
      },
    function(toData,cb){ 
       if (toData) {
         cb(null,toData); 
       } else {
         data = {"@class": "hashtag",name: text};
         console.log(JSON.stringify(data));
         db.save(data, function (err,data) {  if (err) {
          console.log ("db vertex fail"+JSON.stringify(err)+JSON.stringify(data));
           cb(err);
          } else {
           cb(null,data);
          }
         });
        }
       },
    function(toData,cb) {
          console.log ("ok to save from "+fromData["@rid"]+ " to "+ toData["@rid"]);
          console.log (JSON.stringify(fromData));
          console.log (JSON.stringify(toData));
          db.createEdge(
            fromData,  // {"@rid":fromRid, "@class":"mensaje"},
            toData, // {"@rid":rid, "@class": "hashtag"},
            function(err,result) { if (err) { 
                                     console.log("Edge error:"+JSON.stringify(err));
                                     cb(err);
                                    } else {
                                     console.log ("saved_edge_from"+JSON.stringify(fromData));
                                     console.log ("saved_edge_to"+JSON.stringify(toData));
                                     cb(null,fromData);
                                    }
                                  });
       }
    ], function(err,modFrom) {  if (err) {console.log("waterfall  error:"+JSON.stringify(err));} else { cbIter(null,modFrom)} }
   );
}


function createEdges(tweetData, entities) {
  //de momento solo hashtags. Podemos hacer un
  //for key en entities, y considerarlos todos
  //de la misma clase, o hacer un caso
  //especial con mentions, que pueden ser authors o no
  if (entities.hashtags.length > 0) {
    console.log("ht to save to:"+JSON.stringify(entities.hashtags));
    asincrono.reduce(entities.hashtags,
                    tweetData,
                    saveLink,
                    function (err, res) {}
                    );
  }
  //for (var i in entities.hashtags) { 
  //   with (entities.hashtags[i]) {
  //     console.log("ht:"+text+" en "+indices);
  //     saveLink(text); // tweetData,text);
  //     }
  //}
}

function saveTweet(data, finalcall) {
    console.log("saveTweet as "+this.constructor.name);
    if (this.constructor != Holder) { //nos llaman sin contenedor
	new Holder("mensaje",saveTweet,finalcall,data)
	return null;
    }
 
    //nos llaman como objeto 
    if (data)  { // esto es, que comprueba() ha puesto un rid en data
	this.callback(null, data);
	return null;
    }
     
    //no hay rid, es todo nuevo
    data = this.origdata;
    finalcall=this.callback;
 
    var sustituciones = {
	user: function(callback) {
	    saveAuthor(data.user, callback);
	},
	place: function(callback) {
	    if (false) { // (data.place) {
		savePlace(data.place, callback);
	    } else {
               callback();
            }
	},
	retweeted_status: function(callback) {
	    if (false) { // (data.retweet) {
		saveTweet(data.retweeted_status, callback);
	    } else {
               callback();
            }
	}
    };
    console.log("lanzando paralelo "+sustituciones); 
    //ojo, parece que parallell mete un callback en el scope, asi
    //que hay que usar finalcall. 
    asincrono.parallel(sustituciones, function(err, results) {
	if (err) {
	    console.log("fallo el paralelo " + err);
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
                    finalcall(err);
		} else {
		    console.log("result:"+data["@rid"]);
                    console.log("author is "+data.user);
		    // ... y crea entidades; lo hacemos aqui por si hay llamadas recursivas a saveTweet 
		    createEdges(data, data["entities"]);
		    // TO DO: podriamos plantearnos Edges especiales:
		    //     if (in_reply_to_status_id) ...
		    //     if (in_reply_to_user_id) ....
		    //     if (retweeted_status) ....
		    finalcall(null,data["@rid"]);
		}
            });
	}
    });

    console.log("SaveTweet terminando");
    return null;
}

db.open(function(err, result) {
      var sem=0;
//    tweet.stream('statuses/filter', {'track': keywords}, function(stream) {
      tweet.stream('statuses/filter',  {'locations': boxes}, function(stream) {
        //stream.on('error', function(err) {console.log("stream err"+JSON.stringify(err));});
	stream.on('data', function(data) {
//          console.log('@' + data.user.screen_name + ' : ' + data.text);
	    //	fs.writeSync(my_file, JSON.stringify(data), null);
	    //	fs.writeSync(my_file, '\n', null);
	    //	fs.fsyncSync(my_file);
            if (sem == 0) {
            sem++;
            saveTweet(data, function (err,data) {console.log("saved:"+err+":"+data);
                                                 sem--;});
            }  
	});
    });
});
