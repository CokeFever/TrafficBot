# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Open source documentation (LICENSE, README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT)
- GitHub Actions setup guide
- Comprehensive security documentation

### Changed
- Trial API Key now uses environment variables instead of hardcoded values
- Improved RLS policies for better security

### Removed
- `/routine` feature and related code (routes management)
- Monitoring Edge Function
- 39 temporary documentation files (moved to archive/)

### Fixed
- Supabase Security Advisor warnings
- TypeScript errors in tdx-client.ts
- Hardcoded API keys in test files

### Security
- Fixed function search_path security issues
- Improved RLS policies for trial_usage table
- Added is_service_role helper function

## [1.0.0] - 2026-03-12

### Added
- 🅿️ Parking availability search feature
  - Search radius: 250m / 500m / 1km
  - Real-time availability data
  - Fare information display
  - Motorcycle parking support
  - Trial mode: 2 free queries per day

- 🚦 Traffic information query feature
  - Search radius: 250m / 500m / 1km
  - CMS (Changeable Message Signs) integration
  - VD (Vehicle Detectors) integration
  - Smart filtering (hide normal traffic)
  - Severity-based sorting
  - Road segment grouping

- 🔐 Security features
  - Row Level Security (RLS) enabled
  - Encrypted API key storage
  - User data isolation
  - Service role policies

- 📱 Bot commands
  - `/start` - Welcome message
  - `/help` - Command help
  - `/parking` - Search nearby parking
  - `/traffic` - Query nearby traffic
  - `/setup` - Configure TDX API Key
  - `/config` - View configuration
  - `/reset` - Reset configuration

- 🗄️ Database
  - User configurations table
  - User states table
  - Trial usage tracking
  - Cache system
  - Key-value store

- 🚀 Deployment
  - GitHub Actions CI/CD
  - Supabase Edge Functions
  - Automatic migrations
  - Environment variables management

### Technical Details

#### Architecture
- Runtime: Deno (Supabase Edge Functions)
- Database: PostgreSQL (Supabase)
- Bot Framework: Telegraf
- API: TDX (Transport Data eXchange)

#### APIs Integrated
- TDX Parking API
  - `/v2/Bike/Availability/NearBy` - Parking availability
  - `/v2/Bike/Station/NearBy` - Parking stations
- TDX Traffic API
  - `/v2/Road/Traffic/CMS/NearBy` - Traffic messages
  - `/v2/Road/Traffic/Live/CMS/City/{City}` - Live CMS data
  - `/v2/Road/Traffic/VD/NearBy` - Vehicle detectors
  - `/v2/Road/Traffic/Live/VD/City/{City}` - Live VD data

#### Security Measures
- AES-256 encryption for API keys
- Row Level Security (RLS) on all tables
- Fixed search_path for SQL functions
- Environment variables for secrets
- JWT-free webhook (Telegram verification)

---

## Version History

### Version Numbering

We use [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backwards compatible manner
- **PATCH** version for backwards compatible bug fixes

### Release Process

1. Update CHANGELOG.md with changes
2. Update version in package.json
3. Create a git tag: `git tag -a v1.0.0 -m "Release v1.0.0"`
4. Push tag: `git push origin v1.0.0`
5. Create GitHub Release with release notes

---

## Links

- [GitHub Repository](https://github.com/CokeFever/trafficbot)
- [Issues](https://github.com/CokeFever/trafficbot/issues)
- [Pull Requests](https://github.com/CokeFever/trafficbot/pulls)
- [Releases](https://github.com/CokeFever/trafficbot/releases)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute to this project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
