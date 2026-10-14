import { Button } from "@cloudflare/kumo";
import { useNavigate } from "react-router";

export const NotFoundPage = () => {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-xl px-4 py-32 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-3 exo-fg-soft">Nothing lives at this address. Check the link or start from the homepage.</p>
      <Button className="mt-8" variant="primary" onClick={() => navigate("/")}>
        Go to the homepage
      </Button>
    </div>
  );
};
