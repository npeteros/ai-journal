## Setup & Installation

1. **Clone the repository:**

    ```bash
    git clone https://github.com/npeteros/ai-journal.git
    cd ai-journal
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Configure environment variables:**
    - Copy `.env.example` to `.env` and fill in required values.
4. **Set up the database:**

    ```bash
    npx prisma migrate dev
    ```

5. **Start the development server:**

    ```bash
    npm run dev
    ```

6. Open [http://localhost:3000](http://localhost:3000/) in your browser.
