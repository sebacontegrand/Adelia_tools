"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

const formSchema = z.object({
    objective: z.string().min(2, "Objective is required"),
    brandName: z.string().min(1, "Brand name is required"),
    brandVoice: z.string().min(1, "Brand voice is required"),
    audience: z.string().min(2, "Target audience is required"),
    keyMessage: z.string().min(5, "Key message is required"),
    ctaText: z.string().min(2, "CTA text is required"),
    disclaimer: z.string().optional(),
    width: z.coerce.number().min(50, "Width must be at least 50px"),
    height: z.coerce.number().min(50, "Height must be at least 50px"),
    bgImageName: z.string().optional(),
    logoImageName: z.string().optional(),
    productImageNames: z.string().optional(),
    audioName: z.string().optional(),
    youtubeUrl: z.string().optional(),
    palette: z.string().optional(),
    typography: z.string().optional(),
    animationStyle: z.string().min(1, "Animation style is required"),
    creativeFormat: z.enum(["Standard", "Gamified", "Interactive"]).default("Standard"),
    bgImageData: z.string().optional(),
    logoImageData: z.string().optional(),
    productImageDatas: z.array(z.string()).optional(),
    complianceConstraints: z.string().optional(),
    clickTagVar: z.string().default("clickTag"),
    customIdeas: z.string().optional(),
})



interface GeneratedCreative {
    id: string;
    meta: any;
    files: Array<{ path: string, type: string, content: string }>;
}

type FormValues = z.infer<typeof formSchema>

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export function CreativeForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [creatives, setCreatives] = useState<GeneratedCreative[] | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number>(0);
    const [previewSrc, setPreviewSrc] = useState<string>("");
    const [assetsBase64, setAssetsBase64] = useState<Record<string, string>>({});



    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            objective: "",
            brandName: "",
            brandVoice: "",
            audience: "",
            keyMessage: "",
            ctaText: "",
            disclaimer: "",
            width: 300,
            height: 250,
            bgImageName: "bg.jpg",
            logoImageName: "logo.png",
            productImageNames: "prod1.png, prod2.png",
            audioName: "",
            youtubeUrl: "",
            palette: "",
            typography: "Sans-serif modern",
            animationStyle: "subtle",
            creativeFormat: "Standard",
            complianceConstraints: "None",
            clickTagVar: "clickTag",
            customIdeas: "",
        },
    })

    const updatePreview = (ad: GeneratedCreative) => {
        if (ad.files) {
            const indexHtmlFile = ad.files.find((f: any) => f.path === 'index.html');
            const styleCssFile = ad.files.find((f: any) => f.path === "styles.css");
            const scriptJsFile = ad.files.find((f: any) => f.path === "script.js");

            if (indexHtmlFile) {
                let html = indexHtmlFile.content;
                let css = styleCssFile ? styleCssFile.content : "";
                let js = scriptJsFile ? scriptJsFile.content : "";

                // Helper to replace asset paths with Base64
                const injectAssets = (content: string) => {
                    let newContent = content;
                    Object.entries(assetsBase64).forEach(([filename, base64]) => {
                        const regex = new RegExp(`(\\./)?assets/${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
                        newContent = newContent.replace(regex, base64);
                    });
                    return newContent;
                };

                html = injectAssets(html);
                css = injectAssets(css);
                js = injectAssets(js);

                if (css) {
                    if (html.includes('href="styles.css"')) {
                        html = html.replace(/<link rel="stylesheet" href="styles.css"[^>]*>/, `<style>${css}</style>`);
                    } else {
                        html = html.replace('</head>', `<style>${css}</style></head>`);
                    }
                }

                if (js) {
                    if (html.includes('src="script.js"')) {
                        html = html.replace(/<script src="script.js"><\/script>/, `<script>${js}</script>`);
                    } else {
                        html = html.replace('</body>', `<script>${js}</script></body>`);
                    }
                }

                setPreviewSrc(html);
            }
        }
    };

    async function onSubmit(values: FormValues) {
        setIsLoading(true);
        setCreatives(null);
        setPreviewSrc("");

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(values),
            });
            const data = await response.json();

            // Check if data is an array or a single object (fallback)
            const creativeArray = Array.isArray(data) ? data : [data];
            setCreatives(creativeArray);
            setSelectedIndex(0);
            updatePreview(creativeArray[0]);

        } catch (error) {
            console.error("Generator failed", error);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 p-6 min-h-screen justify-center items-start">
            <Card className="w-full max-w-3xl flex-1 border-border/50 bg-card/50">
                <CardHeader className="bg-card border-b text-foreground rounded-t-lg">
                    <CardTitle className="text-2xl font-bold">Adelia HTML5 Creative Generator</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Enter your campaign details to generate a high-performance HTML5 ad creative.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Brand & Objective */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Campaign Strategy</h3>

                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="brandName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Brand Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Acme Corp" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="objective"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Ad Objective</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Drive conversions, Brand Awareness..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="audience"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Target Audience</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Tech-savvy millenials..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="brandVoice"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Brand Voice</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a voice" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Professional & Trustworthy">Professional & Trustworthy</SelectItem>
                                                        <SelectItem value="Playful & Fun">Playful & Fun</SelectItem>
                                                        <SelectItem value="Urgent & Promotional">Urgent & Promotional</SelectItem>
                                                        <SelectItem value="Minimalist & Modern">Minimalist & Modern</SelectItem>
                                                        <SelectItem value="Luxury & Elegant">Luxury & Elegant</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="customIdeas"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Custom Ideas / Instructions</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="e.g. Use a futuristic theme, focus on high-speed motion, use specific punchlines..."
                                                        className="resize-none h-24"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormDescription>Any specific concepts or instructions you want the AI to follow.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Creative Content */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Creative Content</h3>

                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="keyMessage"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Key Message / Headline</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Limited Time Offer!" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="ctaText"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Call to Action (CTA)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Shop Now" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="disclaimer"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Disclaimer (Optional)</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="Terms and conditions apply..." className="resize-none h-20" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Design Specs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Design & Technical</h3>

                                    <div className="flex gap-4">
                                        <FormField<FormValues>
                                            control={form.control as any}
                                            name="width"
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormLabel>Width (px)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField<FormValues>
                                            control={form.control as any}
                                            name="height"
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormLabel>Height (px)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="palette"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Color Palette (Hex Codes)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="#FF0000, #FFFFFF, #000000" {...field} />
                                                </FormControl>
                                                <FormDescription>Comma separated list of hex codes.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="animationStyle"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Animation Style</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select style" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="none">None (Static)</SelectItem>
                                                        <SelectItem value="subtle">Subtle (Fade/Slide)</SelectItem>
                                                        <SelectItem value="energetic">Energetic (Bounce/Pop)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="creativeFormat"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Creative Format</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select format" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Standard">Standard HTML5</SelectItem>
                                                        <SelectItem value="Gamified">Gamified (Mini-Game)</SelectItem>
                                                        <SelectItem value="Interactive">Interactive (Quiz/Poll)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="typography"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Typography</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Sans-serif, Roboto, Open Sans..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Assets */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Asset Filenames</h3>
                                    <CardDescription className="pb-2">
                                        Enter the filenames of assets that will be in the build folder.
                                    </CardDescription>

                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="bgImageName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Background Image</FormLabel>
                                                <FormControl>
                                                    <div className="flex flex-col gap-2">
                                                        <Input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={async (e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const base64 = await fileToBase64(file);
                                                                    setAssetsBase64(prev => ({ ...prev, [file.name]: base64 }));
                                                                    form.setValue("bgImageData", base64);
                                                                    field.onChange(file.name);
                                                                }
                                                            }}
                                                        />
                                                        {field.value && <span className="text-xs text-muted-foreground font-mono">Selected: {field.value}</span>}
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="logoImageName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Logo Image</FormLabel>
                                                <FormControl>
                                                    <div className="flex flex-col gap-2">
                                                        <Input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={async (e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const base64 = await fileToBase64(file);
                                                                    setAssetsBase64(prev => ({ ...prev, [file.name]: base64 }));
                                                                    form.setValue("logoImageData", base64);
                                                                    field.onChange(file.name);
                                                                }
                                                            }}
                                                        />
                                                        {field.value && <span className="text-xs text-muted-foreground font-mono">Selected: {field.value}</span>}
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="productImageNames"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Product Images (Optional)</FormLabel>
                                                <FormControl>
                                                    <div className="flex flex-col gap-2">
                                                        <Input
                                                            type="file"
                                                            accept="image/*"
                                                            multiple
                                                            onChange={async (e) => {
                                                                const files = e.target.files;
                                                                if (files && files.length > 0) {
                                                                    const names: string[] = [];
                                                                    const newAssets: Record<string, string> = {};
                                                                    const newDatas: string[] = [];

                                                                    for (const file of Array.from(files)) {
                                                                        const base64 = await fileToBase64(file);
                                                                        newAssets[file.name] = base64;
                                                                        newDatas.push(base64);
                                                                        names.push(file.name);
                                                                    }

                                                                    setAssetsBase64(prev => ({ ...prev, ...newAssets }));
                                                                    form.setValue("productImageDatas", newDatas);
                                                                    field.onChange(names.join(", "));
                                                                }
                                                            }}
                                                        />
                                                        {field.value && <span className="text-xs text-muted-foreground font-mono truncate max-w-full">Selected: {field.value}</span>}
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField<FormValues>
                                        control={form.control as any}
                                        name="youtubeUrl"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>YouTube Video URL (Optional)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="https://youtube.com/..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="pt-6 border-t">
                                <FormField<FormValues>
                                    control={form.control as any}
                                    name="complianceConstraints"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Compliance Constraints</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Include copyright year, no false claims..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button type="submit" size="lg" className="px-8" disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : "Generate Creative"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {/* Preview Section */}
            <div className="w-full lg:w-[500px] xl:w-[600px] shrink-0 space-y-4 sticky top-6">
                {previewSrc && creatives ? (
                    <Card className="border-border/50 bg-card/50 overflow-hidden">
                        <CardHeader className="bg-muted text-foreground">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-lg">Option {selectedIndex + 1}: {creatives[selectedIndex].id}</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        {creatives[selectedIndex].meta.creativeName} ({creatives[selectedIndex].meta.dimensions.width}x{creatives[selectedIndex].meta.dimensions.height})
                                    </CardDescription>
                                </div>
                                <div className="flex gap-1 bg-background p-1 rounded-md">
                                    {creatives.map((_, i) => (
                                        <Button
                                            key={i}
                                            variant={selectedIndex === i ? "default" : "ghost"}
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={() => {
                                                setSelectedIndex(i);
                                                updatePreview(creatives[i]);
                                            }}
                                        >
                                            {i + 1}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 bg-checkerboard flex items-center justify-center min-h-[400px] bg-muted/20">
                            <div className="p-4 overflow-auto max-w-full max-h-[80vh]">
                                <iframe
                                    key={selectedIndex}
                                    title="Ad Preview"
                                    srcDoc={previewSrc}
                                    width={creatives[selectedIndex].meta.dimensions.width}
                                    height={creatives[selectedIndex].meta.dimensions.height}
                                    style={{ border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', background: 'white' }}
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="bg-card p-4 border-t flex flex-col gap-3">
                            <div className="flex justify-between w-full items-center">
                                <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[70%]">
                                    Files: {creatives[selectedIndex].files.map(f => f.path).join(', ')}
                                </div>
                                <Button size="sm" className="h-8">Download ZIP</Button>
                            </div>
                            {creatives[selectedIndex].meta.notes && creatives[selectedIndex].meta.notes.length > 0 && (
                                <div className="bg-muted p-2 rounded text-[11px] text-muted-foreground italic">
                                    <strong>Designer Notes:</strong> {creatives[selectedIndex].meta.notes[0]}
                                </div>
                            )}
                        </CardFooter>
                    </Card>
                ) : (
                    <Card className="shadow-sm border-dashed">
                        <CardContent className="h-[400px] flex items-center justify-center text-muted-foreground">
                            {isLoading ? "Generating your creative..." : "Fill out the form to generate a creative preview."}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
