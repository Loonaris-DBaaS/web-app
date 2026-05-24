const bcrypt =require('bcryptjs');
const jwt = require('jsonwebtoken');
const signupService = require('../services/signup.service');

app.post('/signup',(req,res,next)=>{
    try {

        const user = await signupService.signup(req.body);

        res.status(201).json({
        success: true,
        message: "User created successfully",
        data: user
        });

    }catch (error) {

        next(error);
    }

})