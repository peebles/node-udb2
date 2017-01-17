# Node Client for UDB2

## Usage

```javascript
let session = require( 'express-session' );
let passport = require('passport');
let LocalStrategy = require('passport-local').Strategy;

let app = express();
let udb = require( 'node-udb2' )( app );
// the config passed in is used as request defaults.  baseUrl
// is required, but you may add anything else you need as defaults
// to be sent on every request, like auth headers, etc.
udb.initialize({
  baseUrl: config.udb.baseUrl
});

app.use( session( config.session ) );

// passport
app.use(passport.initialize());
app.use(passport.session());

// The serializer/deserializer
passport.serializeUser( udb.defaultUserSerializer );
passport.deserializeUser( udb.defaultUserDeserializer );
passport.use( "local", new LocalStrategy(
  { usernameField: 'email', passwordField: 'password' },
  udb.defaultUserAuthenticator );

// Middleware
function authenticated( req, res, next ) {
  if ( req.isAuthenticated() ) { return next(); }
  var realm = req.headers['realm' ] || 'local';
  passport.authenticate( realm, function( err, user, info ) {
    // if err, use err.message
    if ( err ) return res.status( 401 ).send( err.message );
    // if !user, use info.message
    if ( ! user ) return res.status( 401 ).send( info.message );
    // IMPORTANT!  Adjust the session expires to match the
    // values used in udb
    if ( user.session && user.session.expire ) {
      req.session.cookie.expires = new Date( Date.now() + (user.session.expire * 1000) );
      delete user.session;
    }
    req.logIn( user, function( err ) {
      // if err, use err.message
      next();
    });
  })( req, res, next );
}

app.post( '/endpoint', authenticated, udb.has( "admin" ), function( req, res, next ) {
  if ( udb.has( req.user, "admin" ) ) { ... }
  udb.request({
    uri: "/db/accounts/" + req.user.account.id + "/users",
    method: "GET",
    qs: udb.filter({ where: { status: "LOCKED" } })
  }, function( err, users ) {
    if ( err ) return next( err );
    res.json( users );
  });
});
```
