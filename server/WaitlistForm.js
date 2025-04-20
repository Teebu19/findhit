import { useState } from "react";

export default function WaitlistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setName("");
        setEmail("");
      } else {
        setError(data.error || "Oops, something went wrong.");
      }
    } catch (err) {
      setError("Could not connect to server. Try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm mx-auto">
      <input
        type="text"
        placeholder="Your Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border p-2 w-full rounded"
        required
      />
      <input
        type="email"
        placeholder="Your Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2 w-full rounded"
        required
      />
      <button
        type="submit"
        className="bg-black text-white py-2 px-4 rounded hover:bg-gray-800 w-full"
      >
        Join Waitlist
      </button>

      {success && <p className="text-green-600">You're on the waitlist!</p>}
      {error && <p className="text-red-600">{error}</p>}
    </form>
  );
}
app.post('/api/waitlist', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Missing name or email' });
  }

  try {
    // save to DB or log
    console.log('Waitlist entry received:', name, email);

    // respond with success
    res.status(200).json({ message: 'Successfully joined waitlist' });
  } catch (error) {
    console.error('Error saving waitlist entry:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
