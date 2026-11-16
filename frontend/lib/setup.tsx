import { Link } from "react-router-dom";

/**
 * What to do when no newsletter is connected. The same text as the plugin README ("Connecting Ghost").
 */
export function NewsletterSetupHint() {
  return (
    <span className="block space-y-1">
      <span className="block">
        Newsletters come from a connected service. To use Ghost, add your site to the Ghost settings in Configuration and turn on newsletters for it with{" "}
        <code>newsletters: {"{}"}</code>.
      </span>
      <span className="block">
        <Link
          to={`/configuration/${encodeURIComponent("@tokenring-ai/ghost-io")}`}
          className="text-accent hover:text-accent-soft underline-offset-2 hover:underline focus-ring"
        >
          Ghost settings
        </Link>{" "}
        — site URL, Admin API key, and a newsletters block.
      </span>
    </span>
  );
}
