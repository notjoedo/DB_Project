"use client";
import { useLayoutEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { LoaderCircle, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  placeholder?: string;
  required?: boolean;
};
const definitions: Record<
  string,
  { title: string; description: string; fields: Field[] }
> = {
  site: {
    title: "Suggest a planting site",
    description:
      "Share a place that could benefit from trees. A reviewer will assess it before it appears on the map.",
    fields: [
      { key: "name", label: "Site or neighborhood name", required: true },
      { key: "area", label: "Address or area", required: true },
      { key: "lat", label: "Latitude", type: "number", required: true },
      { key: "lng", label: "Longitude", type: "number", required: true },
      { key: "soil", label: "Soil type", options: ["Loam", "Clay", "Sand"] },
      { key: "sun", label: "Sunlight", options: ["Full sun", "Partial shade"] },
      {
        key: "water",
        label: "Available moisture",
        options: ["Moderate", "Moist"],
      },
      {
        key: "space",
        label: "Available mature canopy width (ft)",
        type: "number",
        required: true,
      },
      {
        key: "zone",
        label: "USDA hardiness zone (1–13)",
        type: "number",
        required: true,
      },
      {
        key: "priority",
        label: "Suggested priority",
        options: ["High", "Medium", "Low"],
      },
      {
        key: "text",
        label: "What makes this a good planting site?",
        type: "textarea",
      },
    ],
  },
  question: {
    title: "Ask the community",
    description:
      "Share a question about trees, planting, or caring for your neighborhood.",
    fields: [
      { key: "name", label: "Your question", required: true },
      {
        key: "topic",
        label: "Topic",
        options: [
          "Tree care",
          "Species identification",
          "Planting advice",
          "Volunteering",
        ],
      },
      { key: "text", label: "Details", type: "textarea", required: true },
    ],
  },
  answer: {
    title: "Share an answer",
    description: "Explain what you know and include sources where possible.",
    fields: [
      { key: "text", label: "Your reply", type: "textarea", required: true },
    ],
  },
  hours: {
    title: "Log volunteer hours",
    description:
      "Your hours will be added to your history and sent to an admin for verification.",
    fields: [
      {
        key: "date",
        label: "Participation date",
        type: "date",
        required: true,
      },
      {
        key: "hours",
        label: "Hours volunteered (up to 24)",
        type: "number",
        required: true,
      },
      {
        key: "text",
        label: "What did you help with?",
        type: "textarea",
        required: true,
      },
    ],
  },
  profile: {
    title: "Your community profile",
    description:
      "Tell us about yourself. Certified roles require administrator verification.",
    fields: [
      { key: "name", label: "Display name", required: true },
      { key: "bio", label: "About you", type: "textarea" },
      {
        key: "requested_role",
        label: "Participation or access request",
        options: ["general", "volunteer", "arborist", "admin"],
      },
      {
        key: "certification",
        label: "Arborist certification number / qualifications",
        placeholder: "Required for arborist verification",
      },
    ],
  },
  organization: {
    title: "Submit an organization",
    description:
      "Help neighbors find trusted tree and conservation groups. Organizations are reviewed before listing.",
    fields: [
      { key: "name", label: "Organization name", required: true },
      {
        key: "focus",
        label: "What does the organization do?",
        type: "textarea",
        required: true,
      },
      { key: "url", label: "Website (HTTPS)", type: "url", required: true },
    ],
  },
  opportunity: {
    title: "Post a volunteer opportunity",
    description:
      "An admin reviews new events before the community can register.",
    fields: [
      { key: "name", label: "Event title", required: true },
      { key: "org", label: "Organization", required: true },
      { key: "place", label: "Location / meeting point", required: true },
      { key: "date", label: "Event date", type: "date", required: true },
      {
        key: "time",
        label: "Event time",
        placeholder: "9:00 AM – 12:00 PM",
        required: true,
      },
      {
        key: "hours",
        label: "Duration (hours)",
        type: "number",
        required: true,
      },
      {
        key: "type",
        label: "Activity",
        options: ["Tree planting", "Tree care", "Survey", "Education"],
      },
      {
        key: "text",
        label: "Details and requirements",
        type: "textarea",
        required: true,
      },
    ],
  },
  species: {
    title: "Contribute to the tree catalog",
    description:
      "Add a species or propose a correction. Cite a reliable botanical source; community submissions need review.",
    fields: [
      { key: "name", label: "Common name", required: true },
      { key: "latin", label: "Scientific name", required: true },
      {
        key: "description",
        label: "Species description",
        type: "textarea",
        required: true,
      },
      { key: "habit", label: "Growth habit", required: true },
      {
        key: "height",
        label: "Mature height (ft)",
        type: "number",
        required: true,
      },
      {
        key: "width",
        label: "Mature canopy width (ft)",
        type: "number",
        required: true,
      },
      {
        key: "zoneMin",
        label: "Minimum USDA zone",
        type: "number",
        required: true,
      },
      {
        key: "zoneMax",
        label: "Maximum USDA zone",
        type: "number",
        required: true,
      },
      {
        key: "sunText",
        label: "Sunlight",
        options: ["Full sun", "Partial shade", "Full sun and partial shade"],
      },
      {
        key: "soilText",
        label: "Soil types",
        options: ["Loam", "Clay", "Sand", "Clay, Loam, Sand"],
      },
      { key: "water", label: "Water needs", options: ["Moderate", "Moist"] },
      { key: "native", label: "Native range", required: true },
      {
        key: "wildlife",
        label: "Dependent wildlife and pollinators",
        type: "textarea",
        required: true,
      },
      {
        key: "source",
        label: "Botanical source (HTTPS)",
        type: "url",
        required: true,
      },
    ],
  },
  guide: {
    title: "Publish a tree care guide",
    description: "Share your verified expertise with the community.",
    fields: [
      { key: "name", label: "Guide title", required: true },
      { key: "text", label: "Care guidance", type: "textarea", required: true },
      { key: "url", label: "Supporting resource (HTTPS)", type: "url" },
    ],
  },
};
export default function ContributionForm({
  kind,
  initial,
  onClose,
  onSave,
  user,
}: {
  kind: string | null;
  initial: any;
  onClose: () => void;
  onSave: (payload: any) => Promise<any>;
  user: any;
}) {
  const [values, setValues] = useState<any>({});
  const [busy, setBusy] = useState(false);
  useLayoutEffect(() => {
    if (!kind) return;
    const d = definitions[kind];
    const defaults: any = {};
    d.fields.forEach((f) => {
      defaults[f.key] = f.options?.[0] ?? "";
    });
    setValues({
      ...defaults,
      ...initial,
      zoneMin: initial?.zone?.[0] ?? "",
      zoneMax: initial?.zone?.[1] ?? "",
      sunText:
        initial?.sun?.length > 1
          ? "Full sun and partial shade"
          : (initial?.sun?.[0] ?? "Full sun"),
      soilText: Array.isArray(initial?.soil)
        ? initial.soil.join(", ")
        : "Clay, Loam, Sand",
    });
  }, [kind, initial]);
  if (!kind) return null;
  const config = definitions[kind];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = { ...values };
    if (kind === "site") {
      ["lat", "lng", "zone", "space"].forEach(
        (k) => (payload[k] = Number(payload[k])),
      );
      payload.status = "Community suggested";
      payload.canopy = 0;
      payload.example = false;
    }
    if (kind === "species") {
      payload.zone = [+values.zoneMin, +values.zoneMax];
      payload.height = +values.height;
      payload.width = +values.width;
      payload.sun =
        values.sunText === "Full sun and partial shade"
          ? ["Full sun", "Partial shade"]
          : [values.sunText];
      payload.soil = values.soilText.split(",").map((v: string) => v.trim());
    }
    if (["hours", "opportunity"].includes(kind ?? ""))
      payload.hours = Number(payload.hours);
    const result = await onSave(
      kind === "profile"
        ? {
            action: "profile",
            ...payload,
            requestedRole: values.requested_role,
          }
        : {
            action: "submit",
            kind,
            name: values.name ?? initial?.name,
            payload,
          },
    );
    setBusy(false);
    if (result?.ok) onClose();
  }
  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="contribution-dialog">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        {!user ? (
          <div className="signin-form">
            <p>Sign in to save your contribution and track its progress.</p>
            <a
              className="primary-btn"
              href="/signin-with-chatgpt?return_to=%2F"
              target="_top"
            >
              Sign in with ChatGPT <ArrowUpRight size={16} />
            </a>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="form-fields">
              {config.fields.map((f) => (
                <label
                  className={
                    f.type === "textarea" ? "form-field full" : "form-field"
                  }
                  key={f.key}
                >
                  <span>
                    {f.label}
                    {f.required && <i> *</i>}
                  </span>
                  {f.options ? (
                    <Select
                      value={values[f.key] || f.options[0]}
                      onValueChange={(v) =>
                        setValues((s: any) => ({ ...s, [f.key]: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      required={f.required}
                      maxLength={3000}
                      value={values[f.key] ?? ""}
                      onChange={(e) =>
                        setValues((s: any) => ({
                          ...s,
                          [f.key]: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <input
                      type={f.type ?? "text"}
                      onInput={
                        f.type === "date"
                          ? (e) => {
                              const value = e.currentTarget.value;
                              setValues((s: any) => ({ ...s, [f.key]: value }));
                            }
                          : undefined
                      }
                      required={f.required}
                      step={f.type === "number" ? "any" : undefined}
                      maxLength={f.type === "text" ? 150 : undefined}
                      placeholder={f.placeholder}
                      value={values[f.key] ?? ""}
                      onChange={(e) =>
                        setValues((s: any) => ({
                          ...s,
                          [f.key]: e.target.value,
                        }))
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="form-footer">
              <button
                type="button"
                className="outline-btn compact"
                onClick={onClose}
              >
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={busy}>
                {busy && <LoaderCircle size={16} className="animate-spin" />}
                {kind === "profile"
                  ? "Save profile"
                  : kind === "guide"
                    ? "Publish guide"
                    : "Submit for review"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
