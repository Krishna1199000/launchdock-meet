const prisma = require('../../prisma/client');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    try {
      const { roomId } = req.query;
      
      const meeting = await prisma.meeting.findUnique({
        where: { roomId },
        include: {
          host: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      });
      
      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found' });
      }
      
      res.json({ meeting });
    } catch (error) {
      console.error('Error fetching meeting:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  } else {
    return res.status(405).json({ message: 'Method not allowed' });
  }
};
