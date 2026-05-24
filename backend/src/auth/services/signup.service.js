const prisma = require('../../prisma');
const bcrypt = require("bcrypt");

exports.signup = async (data) => {

  const { username, email, password } = data;

  // 1. check if tenant already exists
  const existingUser = await prisma.tenant.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new Error("Email already in use");
  }

  // 2. hash password
  const hashedPassword = await bcrypt.hash(password, 8);

  // 3. create user in DB
  const user = await prisma.tenant.create({
    data: {
      name,
      email,
      password: hashedPassword
    }
  });

  // 4. return safe user (no password)
  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
};

