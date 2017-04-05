"use strict";

let _ = require( 'lodash' );

module.exports = function( app ) {

  let config;
  let _request;
  let log;
  
  function initialize( _config ) {
    config = _config;

    //app.log.debug( 'node-udb2: config:', config );
    _request = require( 'request' ).defaults( config );

    if ( app.log ) log = app.log;
    else {
      log = require( 'winston' ).configure({
	transports: [
	  new (winston.transports.Console)({
	    level: 'debug',
	    prettyPrint: true,
	    colorize: true,
	    timestamp: true,
	    humanReadableUnhandledException: true,
	  })
	]
      });
    }
  }
  
  function defaultUserSerializer( user, cb ) {
    cb( null, JSON.stringify( user ) ); // serialize the entire user into the session
  }

  function defaultUserDeserializer( userStr, cb ) {
    cb( null, JSON.parse( userStr ) );  // turn it back into an object
  }

  function defaultUserAuthenticator( email, password, cb ) {
    request({
      uri: "/auth/authenticate",
      method: "POST",
      json: { email: email, password: password }
    }, function( err, user ) {
      if ( ! err ) return cb( null, user );
      if ( err.code == 403 ) return cb( null, false, { message: err.message } );
      return cb( err, false );
    });
  }

  function requesterHas( requiredRoles ) {
    return function( req, res, next ) {
      if ( ! req.user.roles ) return res.status( 403 ).end();
      requiredRoles = Array.isArray( requiredRoles ) ? requiredRoles : [ requiredRoles ];
      let intersection = _.intersection( requiredRoles, _.map( req.user.roles, 'name' ) );
      if ( intersection.length ) return next();
      else res.status( 403 ).end(); 
    }
  }
  
  function userHas( user, requiredRoles ) {
    if ( ! user.roles ) return false;
    requiredRoles = Array.isArray( requiredRoles ) ? requiredRoles : [ requiredRoles ];
    let intersection = _.intersection( requiredRoles, _.map( user.roles, 'name' ) );
    if ( intersection.length ) return true;
    else return false;
  }

  function filter( qs ) {
    return { filter: JSON.stringify( qs ) };
  }

  function where( qs ) {
    return { where: JSON.stringify( qs ) };
  }

  function request( opts, cb ) {
    // app.log.debug( 'node-udb2: request:', opts );
    return _request( opts, function( err, res, body ) {
      if ( err ) return cb( err );

      // A 404 could mean you tried a url that does not exist, or it should mean
      // your query found no suitable object.  We'll assume the latter.
      if ( res.statusCode == 404 ) return cb( null, null );
      
      if ( res.statusCode >= 400 ) {
	if ( typeof body == 'object' ) {
	  let e;
	  if ( body.error ) {
	    e = new Error( body.error.message );
	    e.code = body.error.status;
	  }
	  else if ( body.message ) {
	    // This may be Kong indicating that the token has expired
	    if ( body.message.match( /^Bad token/ ) ) body.message = 'User Management API key is incorrect or expired.';
	    e = new Error( body.message );
	    e.code = res.statusCode;
	  }
	  else {
	    e = new Error( JSON.stringify( body ) );
	    e.code = res.statusCode;
	  }
	  return cb( e );
	}
	else {
	  let e = new Error( body || res.statusMessage );
	  e.code = res.statusCode;
	  return cb( e );
	}
      }
      
      if ( typeof body == 'object' ) return cb( null, body );

      if ( body && res.headers && res.headers['content-type'].match( /^application\/json/ ) )
	return cb( null, JSON.parse( body ) );
      else
	return cb( null, body );
    });
  }
  
  return {
    initialize: initialize,
    defaultUserSerializer: defaultUserSerializer,
    defaultUserDeserializer: defaultUserDeserializer,
    defaultUserAuthenticator: defaultUserAuthenticator,
    requesterHas: requesterHas,
    userHas: userHas,
    filter: filter,
    where: where,
    request: request,
  };
}
