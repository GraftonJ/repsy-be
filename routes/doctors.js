const express = require('express')
const router = express.Router()
const knex = require('../knex')
const Joi = require('joi')

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
require('dotenv').config()

const routeCatch = require('./routeCatch')
const { chkBodyParams } = require('./params')

const SALT_ROUNDS = 2

/* **************************************************
*  hashAsync()
*  Returns Promise for pswd_hash
***************************************************** */
function hashAsync(password) {
  // let sHash = "";
  return bcrypt.hash(password, SALT_ROUNDS)
    .then((hashValue) => {
      // sHash = hashValue;
      // console.log("hash: ", hashValue);
      return hashValue
    })
}

/* **************************************************
*  hashCompareAsync()
*  Returns Promise for t/f if pswd matches hash
***************************************************** */
function hashCompareAsync(password, pswd_hash) {
  return bcrypt.compare(password, pswd_hash);
}

/***************************************************/
/* Validates the doctor's ID with JOI*/
/***************************************************/
const validateUserID = (req, res, next) => {
  knex('doctors').where('id', req.params.id).then(([data]) => {
    console.log(data)
    if (!data) {
      return res.status(400).json({
        error: {
          message: `User ID ${req.params.id} not found`
        }
      })
    }
    next()
  })
}

// /* Uses joi to validate data types */
const validatePostBody = (req, res, next) => {
  const postSchema = Joi.object().keys({
    fname: Joi.string().required(),
    lname: Joi.string().required(),
    specialties_id: Joi.number().integer().required(),
    npi_num: Joi.string().required(),
    clinic_name: Joi.string(),
    clinic_address: Joi.string(),
    city: Joi.string(),
    state: Joi.string(),
    zip: Joi.number().integer().required(),
    email: Joi.string().required(),
    password: Joi.string().required(),
    photo: Joi.string()
  })

  const { error } = Joi.validate(req.body, postSchema)

  if (error) {
    return res.status(400).json({ "POST Schema Error": { message: error.details[0].message } })
  }
  next()
}
/****************************************/
// /* Uses joi to build a patch request */
/****************************************/
const buildPatchReq = (req, res, next) => {
  const patchSchema = Joi.object().keys({
    fname: Joi.string().required(),
    lname: Joi.string().required(),
    specialties_id: Joi.number().integer(),
    npi_num: Joi.string().required(),
    clinic_name: Joi.string(),
    clinic_address: Joi.string(),
    city: Joi.string(),
    state: Joi.string(),
    zip: Joi.number().integer().required(),
    email: Joi.string().required(),
    pswd_hash: Joi.string().required(),
    photo: Joi.string()
  })

  const { error } = Joi.validate(req.body, patchSchema)
  if (error) {
    return res.status(400).json({ "PATCH Schema Error": { message: error.details[0].message } })
  }

  const allowedPatchKeys = ['fname', 'lname', 'specialties_id', 'npi_num', 'clinic_name', 'clinic_address', 'city', 'state', 'zip', 'email', 'pswd_hash', 'photo']

  // Constructs the patch request object
  let patchReq = {}
  allowedPatchKeys.forEach(key => {
    if (req.body.hasOwnProperty(key)) { patchReq[key] = req.body[key] }
  })

  // If the patch request is empty or has invalid key names, return an error
  if (Object.keys(patchReq).length === 0) {
    return res.status(400).json({ error: { message: `Empty or invalid patch request` } })
  }

  // Every patch update will create a new 'updated_at' timestamp
  patchReq.updated_at = new Date()

  // Stores the patch request-object into next request
  req.patchReq = patchReq
  next()
}
//
/* GET all doctors record */
router.get('/', (req, res, next) => {
  knex('doctors').then(data => res.status(200).json(data)).catch(err => next(err))
})
//
/* GET single doctors record */
router.get('/:id', validateUserID, (req, res, next) => {
  knex('doctors').where('id', req.params.id).then(([data]) => res.status(200).json(data)).catch(err => next(err))
})


/****************************************************************/
// http POST localhost:3000/doctors/ fname="New Doctor" lname="smith" specialties_id=2 npi_num="1234567891" clinic_name="new clinic" clinic_address="12 new" city="new" state="CO" zip=12332 email=ndoc@gmail.com password="secret"
// /* POST NEW DOCTORS FOR LOGIN */
/***************************************************************/
router.post('/', validatePostBody, (req, res, next) => {

  const { fname, lname, specialties_id, npi_num, clinic_name, clinic_address, city, state, zip, email, password, photo } = req.body
  const oNewDoctor = {
    fname,
    lname,
    specialties_id,
    npi_num,
    clinic_name,
    clinic_address,
    city,
    state,
    zip,
    email,
    pswd_hash: password,
    photo,
  }
  console.log('!!!!!!!!!!!!!!!oNewDoctor:', oNewDoctor)


  // check that the email address not already in use
  knex('doctors')
    .where('email', email)
    .then((aRecsMatchingEmail) => {
      if (aRecsMatchingEmail.length) {
        console.log("fail: email address already exists");
        res.status(409).json({ error: 'email already exists' });
        return;
      }

      console.log("continue: email is unique");

      // get the password hash
      let pswd_hash = ''
      hashAsync(password)
        .then((pswd_hash) => {
          console.log("pswd_hash ", pswd_hash);
            oNewDoctor.pswd_hash = pswd_hash;


      // add the new doctors
    knex('doctors')
      .insert([oNewDoctor]) // param is in the format of the fields so use destructuring
      .returning('*') // gets array of the inserted records
      .then((aRecs) => {
        console.log("--> insert returning: ", aRecs[0].id);

        // set login token in header and return success
        const doctor = aRecs[0]
        const token = getJwtLoginToken(doctor.id);
        res.set('Auth', `Bearer: ${token}`).status(200).json({ doctor });
        return;

      })
      .catch((error) => {
        next(routeCatch(`--- (3) POST /doctors route, error: `, error));
      })
  })
  .catch((error) => {
    next(routeCatch(`--- (2) POST /doctors route, error: `, error));
  })
})
.catch((error) => {
next(routeCatch(`--- POST /doctors route, error: `, error));
})
})

/****************************************************/
//LOGIN ROUTE POST RETURNING DOCTOR LOGIN
/***************************************************/
/* **************************************************
*  Try to log in the user, if successful set JWT in header
*  @body email (string)
*  @body password (string)
*  Return
*    200 { user: { fname, lname, ... } }
*    403 { error: 'email not found'}
*    403 { error: 'password doesn't match }
http POST localhost:3000/doctors/login email=ndoc@gmail.com password="secret"
***************************************************** */
router.post('/login', (req, res, next) => {
  console.log('$$$$$$$$$$$$$$$$$REQ', req)
  console.log(`-- POST /users/login route`);
  const oParams = {
    email: 'string',
    password: 'string',
  };
  console.log('((()))', oParams)
  if (!chkBodyParams(oParams, req, res, next)) {
    return;
  }
  const { email, password } = req.body;
  console.log("email, password: ", email, password);
  knex("doctors")
    .where('email', email)
    .then((aRecs) => {
      if (!aRecs.length) {
        console.log("fail: email not found");
        res.status(403).json({ error: 'email not found' });
        return;
      }
      const doctor = aRecs[0];
      console.log('email found');
      const { pswd_hash } = aRecs[0];
      console.log('pswd hash: ', pswd_hash);
      hashCompareAsync(password, pswd_hash)
        .then((match) => {
          if (!match) {
            console.log("fail: pswd bad");
            res.status(403).json({ error: 'incorrect password' });
            return;
          }

          // set login token in header and return success
          const token = getJwtLoginToken(doctor.id);
          res.set('Auth', `Bearer: ${token}`).status(200).json({ doctor });
          return;

        })
        .catch((error) => {
          next(routeCatch(`--- GET /doctors route`, error));
        })
      })
    .catch((error) => {
      next(routeCatch(`--- GET /doctors route`, error));
    })
})

/* **************************************************
*  POST /logout
*  Log the user out if they are logged in
*    resets the JWT payload loggedIn to false
*  @body email (string)
*  @body password (string)
*  Return
*    200 { message: 'success' }
http POST localhost:3000/users/logout
***************************************************** */
router.post('/logout', (req, res, next) => {
  console.log(`-- POST /users/logout route`);

  // is there a JWT??
  // check that a auth token is even passed
  const auth = req.headers.auth;
  if (!auth) {
    console.log("-- no auth token");
  } else {
    console.log('-- auth token: ', auth);
  }

  // setup the JWT
  const payload = {
    doctorId: 0,
    loggedIn: false,
  };
  console.log('----- JWT_KEY: ', process.env.JWT_KEY);
  const token = jwt.sign(payload, process.env.JWT_KEY, { expiresIn: '7 days' });

  // set token in header and return success
  res.set('Auth', `Bearer: ${token}`).status(200).json({ message: 'success' });
  return
})




/* PATCH specified doctors record */
router.patch('/:id', validateUserID, buildPatchReq, (req, res, next) => {
  const {patchReq} = req

  knex('doctors').where('id', req.params.id).first().update(patchReq).returning('*').then(([data]) => {
    res.status(200).json(data)
  }).catch(err => next(err))
})


/* DELETE specified doctors record */
router.delete('/:id', validateUserID, (req, res, next) => {
  knex('doctors').where('id', req.params.id).first().del().returning('*').then(([data]) => {
    console.log('deleted', data)
    res.status(200).json({deleted: data})
  })
})

//***************************************/
//GET JWT TOKEN FUNCTION
/***************************************/
function getJwtLoginToken(doctorId) {
  const payload = {
    doctorId: doctorId,
    loggedIn: true,
  };
  console.log('----- JWT_KEY: ', process.env.JWT_KEY);
  const token = jwt.sign(payload, process.env.JWT_KEY, { expiresIn: '7 days' });
  return token;
}

module.exports = router
