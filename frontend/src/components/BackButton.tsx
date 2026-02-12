import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

/**
 * Reusable back button that navigates to the previous page.
 * Renders as a ghost button with an arrow icon.
 */
export default function BackButton({ className = "" }: { className?: string }) {
    const navigate = useNavigate();

    return (
        <Button
            variant="ghost"
            size="sm"
            className={`gap-1.5 text-muted-foreground hover:text-foreground ${className}`}
            onClick={() => navigate(-1)}
        >
            <ArrowLeft className="h-4 w-4" />
            Back
        </Button>
    );
}
