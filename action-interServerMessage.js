/*\
title: $:/plugins/OokTech/Bob/action-interServerMessage.js
type: application/javascript
module-type: widget

Action widget that queries a server for a list of tiddlers that match a filter.

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var InterServerMessage = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

/*
Inherit from the base widget class
*/
InterServerMessage.prototype = new Widget();

/*
Render this widget into the DOM
*/
InterServerMessage.prototype.render = function(parent,nextSibling) {
	this.computeAttributes();
	this.execute();
};

/*
Compute the internal state of the widget
*/
InterServerMessage.prototype.execute = function() {
	this.url = this.getAttribute('url');
  this.filter = this.getAttribute('filter');
  this.requestType = this.getAttribute('requestType', 'fetch');
  this.fromWiki = this.getAttribute('fromWiki', 'RootWiki');
  this.toWiki = this.getAttribute('toWiki', null);
  this.tokenKey = this.getAttribute('tokenKey', null);
};

/*
Refresh the widget by ensuring our attributes are up to date
*/
InterServerMessage.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if(Object.keys(changedAttributes).length) {
		this.refreshSelf();
		return true;
	}
	return this.refreshChildren(changedTiddlers);
};

/*
Invoke the action associated with this widget
*/
InterServerMessage.prototype.invokeAction = function(triggeringWidget,event) {
  var self = this;
  if (self.url.slice(-1) === '/') {
    self.url = self.url.slice(-1);
  }
  if (this.requestType === 'fetch') {
    self.url += '/api/fetch'
  } else if (this.requestType === 'push') {
    self.url += '/api/push'
  }
  // make the xmlhttprequest object
  var xhr = new XMLHttpRequest()
  // setup request object
  xhr.open('POST', self.url, true)
  xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')
  // set the onload function
  xhr.onload = function () {
    // do something to response
    if (this.responseText && this.status == "200") {
      // handle the response!
      try {
        var responseData = JSON.parse(this.responseText)
        Object.keys(responseData.tiddlers).forEach(function(title) {
          responseData.tiddlers[title].fields.modified = $tw.utils.stringifyDate(new Date(responseData.tiddlers[title].fields.modified));
            responseData.tiddlers[title].fields.created = $tw.utils.stringifyDate(new Date(responseData.tiddlers[title].fields.created));
          $tw.wiki.addTiddler(new $tw.Tiddler(responseData.tiddlers[title].fields))
        })
      } catch (e) {
        console.log('Can\'t parse response!')
      }
    }
  }
  // Make post body
  var token = localStorage.getItem(this.tokenKey);
  var postString = {
    'type': this.requestType,
    'token': token
  }
  if (this.toWiki) {
    var list = $tw.wiki.filterTiddlers(this.filter);
    var tiddlers = []
    list.forEach(function(title) {
      tiddlers.push($tw.wiki.getTiddler(title))
    })
    postString['toWiki'] = this.toWiki;
    postString['tiddlers'] = tiddlers;
  } else {
    postString['filter'] = this.filter;
    postString['fromWiki'] = this.fromWiki;
  }
  postString = JSON.stringify(postString)
  // send request
  xhr.send('message='+postString);
  return true;
};

exports["action-interServerMessage"] = InterServerMessage;

})();
