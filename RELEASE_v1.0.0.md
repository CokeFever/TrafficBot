# 🎉 TrafficBot v1.0.0 - Open Source Release

**Release Date**: March 12, 2026  
**Tag**: [v1.0.0](https://github.com/CokeFever/trafficbot/releases/tag/v1.0.0)  
**Commit**: [53069e5](https://github.com/CokeFever/trafficbot/commit/53069e5)

---

## 🌟 Highlights

This is the first stable release of TrafficBot, now available as open source under the MIT License!

TrafficBot is a Telegram bot that provides real-time parking availability and traffic information in Taiwan using the TDX (Transport Data eXchange) API.

---

## ✨ Features

### 🅿️ Parking Search
- Search nearby parking lots within 250m / 500m / 1km radius
- Real-time availability data
- Fare information display
- Motorcycle parking support
- Trial mode: 2 free queries per day

### 🚦 Traffic Information
- Query nearby traffic conditions within 250m / 500m / 1km radius
- CMS (Changeable Message Signs) integration
- VD (Vehicle Detectors) integration
- Smart filtering (hide normal traffic)
- Severity-based sorting
- Road segment grouping

### 🔐 Security
- Row Level Security (RLS) enabled on all tables
- Encrypted API key storage (AES-256)
- User data isolation
- Fixed search_path for SQL functions
- Environment variables for secrets

### 📱 Bot Commands
- `/start` - Welcome message
- `/help` - Command help
- `/parking` - Search nearby parking
- `/traffic` - Query nearby traffic
- `/setup` - Configure TDX API Key
- `/config` - View configuration
- `/reset` - Reset configuration

---

## 🚀 Deployment

### Quick Start
1. Clone the repository
2. Set up Supabase project
3. Configure environment variables
4. Deploy using GitHub Actions

See [Quick Start Guide](docs/quick-start.md) for detailed instructions.

### GitHub Actions
- Automatic deployment on push to main
- Database migrations
- Edge Functions deployment

---

## 📚 Documentation

- [README.md](README.md) - Project overview
- [Quick Start Guide](docs/quick-start.md) - Get started quickly
- [User Guide](docs/user-guide.md) - How to use the bot
- [TDX API Guide](docs/tdx-api-guide.md) - TDX API integration
- [Deploy to Supabase](docs/deploy-supabase.md) - Supabase deployment
- [GitHub Actions Setup](docs/github-actions-setup.md) - CI/CD setup

---

## 🔧 Technical Details

### Architecture
- **Runtime**: Deno (Supabase Edge Functions)
- **Database**: PostgreSQL (Supabase)
- **Bot Framework**: Telegraf
- **API**: TDX (Transport Data eXchange)

### APIs Integrated
- TDX Parking API
  - `/v2/Bike/Availability/NearBy` - Parking availability
  - `/v2/Bike/Station/NearBy` - Parking stations
- TDX Traffic API
  - `/v2/Road/Traffic/CMS/NearBy` - Traffic messages
  - `/v2/Road/Traffic/Live/CMS/City/{City}` - Live CMS data
  - `/v2/Road/Traffic/VD/NearBy` - Vehicle detectors
  - `/v2/Road/Traffic/Live/VD/City/{City}` - Live VD data

---

## 🛡️ Security Improvements

This release includes several security enhancements:

1. **Fixed Function Search Path Issues**
   - Added fixed `search_path = public, pg_temp` to all SQL functions
   - Prevents search path manipulation attacks

2. **Improved RLS Policies**
   - Split service role policies by operation (SELECT, INSERT, UPDATE, DELETE)
   - Added validation checks for INSERT and UPDATE operations
   - Satisfies Supabase Security Advisor requirements

3. **Environment Variables**
   - Removed hardcoded API keys
   - All secrets now use environment variables
   - Updated `.env.example` with proper documentation

---

## 🗑️ Removed Features

- `/routine` feature (route monitoring) - TDX API doesn't support route-based queries
- Monitoring Edge Function
- 39 temporary documentation files (moved to archive/)

---

## 🤝 Contributing

We welcome contributions! Please see:
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Code of conduct
- [SECURITY.md](SECURITY.md) - Security policy

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- **Repository**: https://github.com/CokeFever/trafficbot
- **Issues**: https://github.com/CokeFever/trafficbot/issues
- **Discussions**: https://github.com/CokeFever/trafficbot/discussions
- **Releases**: https://github.com/CokeFever/trafficbot/releases

---

## 🙏 Acknowledgments

- TDX (Transport Data eXchange) for providing the API
- Supabase for the backend infrastructure
- Telegram for the bot platform

---

## 📊 Statistics

- **Lines of Code**: ~3,000+
- **Files**: 50+
- **Migrations**: 8
- **Documentation**: 15+ files
- **Test Files**: 15+

---

## 🎯 Next Steps

After this release, you can:

1. **Check Supabase Security Advisor** to confirm all warnings are resolved
2. **Create GitHub Release** with this content as release notes
3. **Share the project** with the community
4. **Monitor usage** and gather feedback
5. **Plan future features** based on user needs

---

**Thank you for using TrafficBot!** 🚗🅿️🚦
