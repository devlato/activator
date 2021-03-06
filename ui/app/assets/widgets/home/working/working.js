/*
 Copyright (C) 2014 Typesafe, Inc <http://typesafe.com>
 */
define([
  'commons/websocket',
  'text!./working.html',
  'widgets/modals/modals'
], function(
  websocket,
  tpl,
  modals
) {

  var logs = ko.observableArray([]);
  var scroll = ko.observable("stick");


  // Cache the dom Logs, for better performances
  // Not very elegant, but much, much, much more efficient.
  var logsView = ko.tpl("ul", {logEach: logs, css: "logs", id: "loading-logs"}, [
    ko.tpl("li", { attr: { 'data-bind': "text: message"} }, [])
  ]);

  var State = {
    logs: logs,
    logsView: logsView,
    scroll: scroll
  };

  var failedDueToNoTypesafeProperties = false;
  var failedDueToNoSubscriptionId = false;
  var failedToLoad = false;

  var sbtEventStream = websocket.subscribe('type','sbt');
  var subTypeEventStream = function(subType) {
    return sbtEventStream.matchOnAttribute('subType',subType);
  };

  subTypeEventStream("DetachedEvent").each(function(message) {
    var event = message.event;

    var name = event.serialized.$type;

    if (name === "com.typesafe.rp.protocol.SubscriptionIdEvent") {
      debug && console.log("SubscriptionIdEvent: ", event.serialized);
      if (!event.serialized.fileExists)
        failedDueToNoTypesafeProperties = true;
      else if (!event.serialized.subscriptionId)
        failedDueToNoSubscriptionId = true;
    }
  });

  subTypeEventStream("BuildFailedToLoad").each(function (e) {
    failedToLoad = true;
  });

  subTypeEventStream("DetachedLogEvent").fork().each(function(message) {
    if (message.event.entry.level !== "debug") {
      logs.push({
        message: message.event.entry.message,
        type: "info"
      });
    }
  });

  var redirect = function(appId) {
    // NOTE - Comment this out if you want to debug showing logs!
    window.location.href = window.location.href.replace('home', 'app/'+appId+'/');
  };

  var maybeWarnThenRedirect = function(appId) {
    var warning = null;

    if (failedDueToNoTypesafeProperties) {
      warning = "If you are creating Typesafe Reactive Platform project you must add a '<code>typesafe.properties</code>' file in the '<code>&lt;template&gt;/project</code>' folder.</p><p>The file must contain your subscription ID in the format '<code>typesafe.subscription=&lt;YOUR ID&gt;</code>'<br/>To get a free trial subscription ID visit: <a href='https://typesafe.com/account/id' target='_blank'>https://typesafe.com/account/id</a><p>";
    } else if (failedDueToNoSubscriptionId) {
      warning = "If you are creating Typesafe Reactive Platform project, <code>project/typesafe.properties</code> must  contain your subscription ID in the format '<code>typesafe.subscription=&lt;YOUR ID&gt;</code>'<br/>To get a free trial subscription ID visit: <a href='https://typesafe.com/account/id' target='_blank'>https://typesafe.com/account/id</a><p>";
    } else if (failedToLoad) {
      warning = "The build configuration for this project did not load correctly.";
    }

    if (warning) {
      var warningNode = $("<article/>").html(warning)[0];
      modals.show({
        shape: "large",
        title: "Could not load build configuration",
        body: warningNode,
        cancel: "Proceed",
        onCancel: function() {
          redirect(appId);
        }
      });
    } else {
      redirect(appId);
    }
  };

  websocket.subscribe({ response: String }).fork().each(function(message) {
    switch(message.response) {
      case 'Status':
        logs.push({
          message: message.info,
          type: "info"
        });
        break;
      case 'BadRequest':
        // TODO - Do better than an alert!
        window.alert('Unable to perform request: ' + message.errors.join(' \n'));
        $('#working, #open, #new').toggle();
        break;
      case 'RedirectToApplication':
        maybeWarnThenRedirect(message.appId);
        break;
    }
  });


  return {
    render: function() {
      var dom = ko.bindhtml(tpl, State);

      return dom;
    }
  };

});
