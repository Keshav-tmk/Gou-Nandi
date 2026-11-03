"""Update CowDetailsPage.tsx to handle 403 Forbidden cross-farm cattle access."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
file_path = ROOT / "frontend" / "src" / "pages" / "CowDetailsPage.tsx"

text = file_path.read_text(encoding="utf-8")

# Add accessDenied state
old_state = "const [isLoading, setIsLoading] = useState<boolean>(true);"
new_state = """const [isLoading, setIsLoading] = useState<boolean>(true);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);"""

if old_state in text and "accessDenied" not in text:
    text = text.replace(old_state, new_state, 1)

# In catch:
old_catch = """      } catch (err) {
        // Fallback to static profile"""

new_catch = """      } catch (err: any) {
        if (err && err.status === 403) {
          setAccessDenied(true);
          setIsLoading(false);
          return;
        }
        // Fallback to static profile"""

if old_catch in text:
    text = text.replace(old_catch, new_catch, 1)

# In render:
render_check = "if (isLoading) {"
access_denied_render = """  if (accessDenied) {
    return (
      <div className="py-12 px-4 max-w-lg mx-auto">
        <Card className="p-8 text-center bg-white dark:bg-farm-darkCard border border-red-200 dark:border-red-900/60 rounded-2xl shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/50 text-[#D84343] flex items-center justify-center mx-auto mb-4 border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[#263238] dark:text-white">
            Access Restricted to Your Farm Only
          </h2>
          <p className="text-xs text-[#607067] dark:text-gray-400 mt-2 leading-relaxed">
            The requested cattle record (<span className="font-bold text-[#263238] dark:text-white">{cowId}</span>) belongs to another dairy farm. Strict GouNandi backend data isolation prohibits cross-farm access.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => navigate('/cows')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to My Herd Registry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (isLoading) {"""

if render_check in text and "if (accessDenied)" not in text:
    text = text.replace(render_check, access_denied_render, 1)

file_path.write_text(text, encoding="utf-8")
print("CowDetailsPage.tsx updated with 403 Forbidden handling!")

