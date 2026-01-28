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
    complianceConstraints: z.string().optional(),
    clickTagVar: z.string().default("clickTag"),
})



interface GeneratedCreative {

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
    const [creative, setCreative] = useState<GeneratedCreative | null>(null);
    const [previewSrc, setPreviewSrc] = useState<string>("");



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
        },
    })

    async function onSubmit(values: FormValues) {
        setIsLoading(true);
        setCreative(null);
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
            setCreative(data);

            // Assemble preview
            if (data.files) {
                const indexHtmlFile = data.files.find((f: any) => f.path === 'index.html');
                const styleCssFile = data.files.find((f: any) => f.path === "styles.css");
                const scriptJsFile = data.files.find((f: any) => f.path === "script.js");

                if (indexHtmlFile) {
                    let html = indexHtmlFile.content;

                    // Inject CSS
                    if (styleCssFile) {
                        // Replace <link rel="stylesheet" href="styles.css"> with inline style
                        // Simple replacement for now, assumes standard formatting or just append if not found
                        if (html.includes('href="styles.css"')) {
                            html = html.replace('<link rel="stylesheet" href="styles.css">', `<style>${styleCssFile.content}</style>`);
                        } else {
                            html = html.replace('</head>', `<style>${styleCssFile.content}</style></head>`);
                        }
                    }

                    // Inject JS
                    if (scriptJsFile) {
                        // Replace <script src="script.js"></script> with inline script
                        if (html.includes('src="script.js"')) {
                            html = html.replace('<script src="script.js"></script>', `<script>${scriptJsFile.content}</script>`);
                        } else {
                            html = html.replace('</body>', `<script>${scriptJsFile.content}</script></body>`);
                        }
                    }

                    setPreviewSrc(html);
                }
            }

        } catch (error) {
            console.error("Generator failed", error);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 p-6 bg-slate-50 min-h-screen justify-center items-start">
            <Card className="w-full max-w-3xl shadow-xl flex-1">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
                    <CardTitle className="text-2xl font-bold">Adelia HTML5 Creative Generator</CardTitle>
                    <CardDescription className="text-blue-100">
                        Enter your campaign details to generate a high-performance HTML5 ad creative.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Brand & Objective */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Campaign Strategy</h3>

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
                                </div>

                                {/* Creative Content */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Creative Content</h3>

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
                                    <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Design & Technical</h3>

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
                                    <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Asset Filenames</h3>
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
                                                    <div className="flex gap-2 items-center">
                                                        <Input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={async (e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const base64 = await fileToBase64(file);
                                                                    form.setValue("bgImageData", base64);
                                                                    field.onChange(file.name);
                                                                }
                                                            }}
                                                        />
                                                        {field.value && <span className="text-xs text-muted-foreground">{field.value}</span>}
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
                                                    <Input placeholder="logo.png" {...field} />
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
                                                    <div className="flex gap-2 items-center">
                                                        <Input
                                                            type="file"
                                                            accept="image/*"
                                                            multiple
                                                            onChange={async (e) => {
                                                                const files = e.target.files;
                                                                if (files && files.length > 0) {
                                                                    // For now just take the first one or handle text logic.
                                                                    // The schema expects a comma-separated string of names.
                                                                    // We won't upload multiple product images fully in this prototype yet.
                                                                    const file = files[0];
                                                                    // field.onChange(file.name); // Just set the name for now
                                                                    // In a real app we'd map all files to base64.
                                                                    // Let's just do single product image for simplicity of the prompt.
                                                                    field.onChange(Array.from(files).map(f => f.name).join(", "));
                                                                }
                                                            }}
                                                        />
                                                        {field.value && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{field.value}</span>}
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
                                <Button type="submit" size="lg" className="px-8 bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
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
                {previewSrc && creative ? (
                    <Card className="shadow-xl overflow-hidden">
                        <CardHeader className="bg-slate-800 text-white">
                            <CardTitle>Creative Preview</CardTitle>
                            <CardDescription className="text-slate-300">
                                {creative.meta.creativeName} ({creative.meta.dimensions.width}x{creative.meta.dimensions.height})
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 bg-checkerboard flex items-center justify-center min-h-[300px] bg-slate-200/50">
                            {/* Wrapper to handle scaling if needed, for now just centering */}
                            <div className="p-4 overflow-auto max-w-full max-h-[80vh]">
                                <iframe
                                    title="Ad Preview"
                                    srcDoc={previewSrc}
                                    width={creative.meta.dimensions.width}
                                    height={creative.meta.dimensions.height}
                                    style={{ border: 'none', boxShadow: '0 0 20px rgba(0,0,0,0.1)' }}
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="bg-white p-4 border-t flex justify-between">
                            <div className="text-xs text-muted-foreground">
                                Files: {creative.files.map(f => f.path).join(', ')}
                            </div>
                            <Button variant="outline" size="sm">Download ZIP</Button>
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
