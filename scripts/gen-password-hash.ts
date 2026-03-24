import bcrypt from 'bcryptjs'

const password = process.argv[2]

if (!password) {
  console.error('Usage: npx tsx scripts/gen-password-hash.ts <password>')
  process.exit(1)
}

bcrypt.hash(password, 12).then(hash => console.log(hash))
