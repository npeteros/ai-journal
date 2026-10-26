# Table of Contents

-   [Git Conventions and Standards](#git-conventions-and-standards)
    -   [Repository Structure](#repository-structure)
    -   [Branching Strategy](#branching-strategy)
    -   [Commit Standards](#commit-standards)
    -   [Pull Request (PR) Process](#pull-request-pr-process)
    -   [Version Tagging](#version-tagging)
-   [Step-by-Step Instructions for Developers](#step-by-step-instructions-for-developers)
    -   [Setting Up Git](#setting-up-git)
    -   [Cloning the Repository](#cloning-the-repository)
    -   [Creating a New Branch](#creating-a-new-branch)
    -   [Writing and Committing Code](#writing-and-committing-code)
    -   [Pushing Your Branch](#pushing-your-branch)
    -   [Creating a Pull Request (PR)](#creating-a-pull-request-pr)
    -   [Updating Your Branch](#updating-your-branch)
    -   [Merging Your Branch](#merging-your-branch)
    -   [Best Practices](#best-practices)

# **Git Conventions and Standards**

### Repository Structure

-   **Main Branches:**
    -   `main`: Stable branch containing production-ready code.
    -   `develop`: Integration branch for ongoing development.
-   **Ticket Branches:** Use ticket IDs in branch names for traceability (e.g., `S1-03` for Sprint 1, Ticket 3).

### Branching Strategy

-   Avoid direct commits to `main` or `develop`.
-   Use Pull Requests (PRs) for merging changes.

### Commit Standards

-   **Message Format:** `[type]: [description]`
    -   Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
    -   Example: `feat: add user login functionality.`
-   **Granularity:** Commit small, logical changes.

### Pull Request (PR) Process

-   Use a clear title format: `[Ticket ID] [Ticket Title]` (e.g., `[S1-03] Landing Page`).
-   Provide a detailed description.
-   **Assign reviewers and wait for approval before merging.**

### Version Tagging

-   Use semantic versioning: `v[MAJOR].[MINOR].[PATCH]` (e.g., `v1.0.0`).

---

# **Step-by-Step Instructions for Developers**

### Setting Up Git

1. Install Git from [Git's official site](https://git-scm.com/).
2. Set up your Git profile:

```powershell
git config --global user.name "Your Name"

git config --global user.email "your.email@example.com"
```

1. Verify configuration:

    ```powershell
    git config --list
    ```

### Cloning the Repository

1. Copy the repository URL.
2. Navigate to your desired folder:

    ```powershell
    cd /path/to/your/workspace
    ```

3. Clone the repository:

    ```powershell
    git clone <repository-url>
    ```

4. Enter the project folder:

    ```powershell
    cd <repository-name>
    ```

### Creating a New Branch

1. Switch to the develop branch and pull the latest changes:

```powershell
git checkout develop

git pull origin develop
```

1. Create a feature branch:

    ```powershell
    git checkout -b feature/[short-description]
    ```

    Example:

    ```powershell
    git checkout -b feature/add-donation-form
    ```

### Writing and Committing Code

1. Write your code and save changes.
2. Check modified files:

    ```powershell
    git status
    ```

3. Add files to staging:

    ```powershell
    git add [file-name]
    ```

    Or add all changes:

    ```powershell
    git add .
    ```

4. Commit changes with a message:

    ```powershell
    git commit -m "feat: add donation form UI"
    ```

### Pushing Your Branch

1. Push your branch to the remote repository:

    ```powershell
    git push origin feature/[short-description]
    ```

    Example:

    ```powershell
    git push origin feature/add-donation-form
    ```

### Creating a Pull Request (PR)

1. Open the repository on GitHub.
2. Find your branch and click "Compare & pull request."
3. Fill out the PR details:
    - Title: `[Type] [short description]` (e.g., `[feat] Add donation form UI`).
    - Description: Explain what you did and why.
4. Assign reviewers and submit the PR.

### Updating Your Branch

1. Pull updates from develop:

    ```powershell
    git checkout develop

    git pull origin develop

    git checkout feature/[short-description]

    git merge develop
    ```

2. Resolve conflicts if any:

    ```powershell
    git add [file-name]
    git merge --continue
    ```

### Merging Your Branch

1. After PR approval, merge into develop.
2. Sync the branch:

    ```powershell
    git checkout develop

    git pull origin develop
    ```

### Best Practices

-   Pull changes frequently to avoid conflicts:
    ```powershell
    git pull origin develop
    ```
-   Write clear commit messages.
-   Clean up merged branches:
    ```powershell
    git branch -d feature/[short-description]
    ```
