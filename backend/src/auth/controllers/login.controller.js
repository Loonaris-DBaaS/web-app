async function login(req, res) {
    const {name,email,password} = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email and password are required' });
    }
}