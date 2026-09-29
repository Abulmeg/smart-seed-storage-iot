require("dotenv").config();

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing from .env");
}

const users = [
  {
    id: 1,
    username: "viewer",
    passwordHash: bcrypt.hashSync("viewer123", 10),
    role: "viewer",
  },
  {
    id: 2,
    username: "operator",
    passwordHash: bcrypt.hashSync("operator123", 10),
    role: "operator",
  },
  {
    id: 3,
    username: "admin",
    passwordHash: bcrypt.hashSync("admin123", 10),
    role: "admin",
  },
];

async function authenticateCredentials(username, password) {
  const user = users.find(
    (user) => user.username === username
  );

  if (!user) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!passwordMatches) {
    return null;
  }

  return user;
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );
}

function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  const token = authorization.slice(7);

  try {
    req.user = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    next();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Insufficient permissions",
      });
    }

    next();
  };
}

module.exports = {
  authenticateCredentials,
  createToken,
  authenticateToken,
  authorizeRoles,
};