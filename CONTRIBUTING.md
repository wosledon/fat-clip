# Contributing to Fat Clip

Thank you for your interest in contributing to Fat Clip! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/wosledon/fat-clip.git`
3. Create a new branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://www.rust-lang.org/) (latest stable)
- [Git](https://git-scm.com/)

### Linux Dependencies

```bash
# Ubuntu/Debian (Ubuntu 22.04+)
sudo apt-get install libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

# Fedora
sudo dnf install gtk3-devel webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel

# Arch
sudo pacman -S gtk3 webkit2gtk-4.1 libappindicator-gtk3 librsvg
```

### Install and Run

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

## Code Style

### Frontend (TypeScript/React)

- Follow the existing code style
- Use meaningful variable names
- Add comments for complex logic
- Run `npm run lint` before committing

### Backend (Rust)

- Follow Rust naming conventions
- Use `cargo fmt` to format code
- Use `cargo clippy` to check for issues
- Write doc comments for public APIs

## Commit Messages

Use conventional commits format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Example: `feat: add image thumbnail support`

## Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the CHANGELOG.md with your changes
3. Ensure all tests pass
4. Link any related issues in the PR description
5. Request review from maintainers

## Reporting Bugs

When reporting bugs, please include:

- OS and version
- Fat Clip version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots if applicable

## Feature Requests

We welcome feature requests! Please:

- Check if the feature has already been requested
- Provide a clear use case
- Explain why the feature would be useful

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to:

- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what is best for the community

## Release & Signing

For information about the secrets required by the release workflow (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`), see [docs/release-setup.md](docs/release-setup.md).

## Questions?

Feel free to open an issue or start a discussion if you have any questions!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
