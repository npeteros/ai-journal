export default function CheckEmailPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 text-center dark:bg-black">
      <div className="max-w-sm space-y-2">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Check your email</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          We sent you a confirmation link. Click it to finish creating your account.
        </p>
      </div>
    </div>
  );
}
