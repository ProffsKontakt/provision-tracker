# AI Integration Setup Guide

This guide covers setting up OpenAI API integration for call transcriptions, summaries, and AI-powered sales coaching.

## Features

- **Automatic Call Transcription** using OpenAI Whisper
- **AI-Generated Summaries** for quick review
- **Sales Coaching Analysis** with personalized feedback
- **Batch Processing** for multiple calls
- **Cost Tracking** for AI API usage
- **Swedish Language Support** optimized for solar sales

## Prerequisites

1. **OpenAI API Account**
   - Sign up at https://platform.openai.com
   - Add payment method (required for Whisper and GPT-4)
   - Generate API key

2. **Audio Recording Access**
   - Adversus call recordings must be accessible via URL
   - Supported formats: MP3, WAV, M4A (Whisper supports most formats)
   - File size limit: 25MB per file

## Environment Setup

### 1. OpenAI API Configuration

Add to your `.env` file:

```env
# OpenAI API key (required)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional: Internal API key for batch processing
INTERNAL_API_KEY=your-secure-internal-key
```

### 2. Verify API Access

Test your OpenAI configuration:

```bash
curl https://your-app.com/api/ai/transcribe \
  -H "Content-Type: application/json" \
  -d '{"action": "check_config"}'
```

Expected response:
```json
{
  "configured": true,
  "availableModels": {
    "transcription": "whisper-1",
    "analysis": "gpt-4o",
    "summary": "gpt-4o-mini"
  }
}
```

## Usage

### 1. Single Call Transcription

**Via Admin Dashboard:**
1. Go to Admin Dashboard → AI & Coaching tab
2. Select a call from the processing queue
3. Click "Bearbeta" to start transcription
4. Monitor progress in real-time

**Via API:**
```bash
curl -X POST https://your-app.com/api/ai/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "call_123",
    "includeAnalysis": true,
    "includeSummary": true
  }'
```

### 2. Batch Processing

**Process multiple calls:**
```bash
curl -X POST https://your-app.com/api/ai/batch-transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "callIds": ["call_1", "call_2", "call_3"],
    "includeAnalysis": true,
    "includeSummary": true,
    "priority": "normal"
  }'
```

**Monitor batch progress:**
```bash
curl https://your-app.com/api/ai/batch-transcribe?batchJobId=batch_123
```

### 3. Sales Training Materials

Upload training materials for better coaching:

```bash
curl -X POST https://your-app.com/api/admin/training-materials \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Objection Handling Guide",
    "type": "manual",
    "category": "objection_handling",
    "content": "När kunden säger att de inte har råd...",
    "priority": 8
  }'
```

## AI Processing Pipeline

### Step 1: Audio Transcription
- **Model**: OpenAI Whisper (`whisper-1`)
- **Language**: Swedish (`sv`)
- **Output**: Full text transcription
- **Cost**: ~$0.006 per minute

### Step 2: Summary Generation
- **Model**: GPT-4o Mini (cost-effective)
- **Input**: Transcription + call metadata
- **Output**: Concise Swedish summary
- **Cost**: ~$0.0001 per call

### Step 3: Sales Coaching Analysis
- **Model**: GPT-4o (high quality)
- **Input**: Transcription + training materials + call context
- **Output**: Structured coaching feedback
- **Analysis includes**:
  - Sales score (1-10)
  - Customer sentiment
  - Call quality assessment
  - Improvement areas
  - Personalized coaching feedback

## Swedish Sales Coaching Framework

### Coaching Categories

1. **Rapport-byggande** (Rapport Building)
   - First impressions
   - Building trust
   - Swedish cultural sensitivity

2. **Behovsanalys** (Needs Analysis)
   - Effective questioning techniques
   - Understanding customer requirements
   - Qualifying prospects

3. **Produktpresentation** (Product Presentation)
   - Solar panel benefits
   - Environmental focus
   - Economic advantages

4. **Invändningshantering** (Objection Handling)
   - Price concerns
   - Technical questions
   - Timeline objections

5. **Avslutning** (Closing)
   - Next steps
   - Meeting scheduling
   - Follow-up commitments

### Sample Coaching Output

```json
{
  "summary": "Kunden visade intresse för solceller men hade frågor om kostnad och installation.",
  "salesScore": 7,
  "customerSentiment": "positive",
  "callQuality": "good",
  "improvementAreas": [
    "Hantering av prisinvändningar",
    "Konkreta nästa steg"
  ],
  "coachingFeedback": "Bra jobbat med att bygga rapport! Kunden verkade engagerad. Nästa gång, försök att vara mer specifik om besparingar i kronor när kunden frågar om kostnad..."
}
```

## Cost Management

### Estimated Costs (USD)

| Operation | Model | Cost per Call | Notes |
|-----------|-------|---------------|--------|
| Transcription | Whisper-1 | $0.03-0.12 | 5-20 min calls |
| Summary | GPT-4o Mini | $0.001 | Very cost-effective |
| Coaching Analysis | GPT-4o | $0.05-0.15 | High-quality analysis |
| **Total per call** | - | **$0.08-0.28** | Depends on call length |

### Monthly Budget Planning

For 100 calls/month:
- Light processing (transcription only): ~$8/month
- Full processing (transcription + coaching): ~$15-25/month

### Cost Optimization Tips

1. **Use batch processing** for better rate limiting
2. **Filter calls** - only process successful/marked calls
3. **Adjust analysis depth** - skip coaching for short calls
4. **Monitor usage** via the admin dashboard

## Training Materials Management

### Supported Formats

1. **Manual Entry** - Direct text input
2. **PDF Upload** - Extracted text content
3. **TXT Files** - Plain text documents

### Best Practices

```bash
# Create category structure
curl -X POST /api/admin/training-materials -d '{
  "title": "Rapport Building Techniques",
  "category": "rapport_building",
  "type": "manual",
  "content": "1. Använd kundens namn...",
  "priority": 9,
  "tags": ["basics", "swedish_culture"]
}'

# Objection handling scripts
curl -X POST /api/admin/training-materials -d '{
  "title": "Price Objection Responses",
  "category": "objection_handling",
  "type": "manual",
  "content": "När kunden säger att det är för dyrt:\n1. Fokusera på besparingar över tid...",
  "priority": 8
}'
```

### Training Categories

- `rapport_building` - Building customer relationships
- `objection_handling` - Overcoming customer concerns
- `closing` - Finishing the sale
- `product_knowledge` - Solar panel technical info
- `compliance` - Swedish regulations and requirements

## Monitoring and Analytics

### Performance Metrics

Access via Admin Dashboard → AI & Coaching:

1. **Processing Stats**
   - Calls processed per day/week/month
   - Success/failure rates
   - Average processing time

2. **Cost Tracking**
   - Daily/monthly API costs
   - Cost per call breakdown
   - Budget alerts

3. **Quality Metrics**
   - Average sales scores
   - Improvement trends
   - Common coaching areas

### System Logs

All AI processing is logged:

```bash
# View recent AI activity
curl https://your-app.com/api/admin/dashboard | jq '.systemLogs[] | select(.type == "ai_processing")'

# Check for errors
curl https://your-app.com/api/ai/transcribe?status=failed
```

## Troubleshooting

### Common Issues

**1. "OpenAI API not configured"**
- Verify `OPENAI_API_KEY` in environment variables
- Check API key has sufficient credits
- Test key: `curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models`

**2. "Failed to download audio"**
- Check if recording URL is accessible
- Verify Adversus recording permissions
- Test URL manually: `curl -I $RECORDING_URL`

**3. "Transcription failed"**
- Check audio file format (MP3, WAV supported)
- Verify file size < 25MB
- Check for corrupted recordings

**4. High API costs**
- Review call filtering settings
- Disable coaching for short calls
- Use batch processing
- Monitor usage dashboard

### Debug Mode

Enable detailed logging:

```env
# Add to .env for debugging
DEBUG_AI_PROCESSING=true
LOG_LEVEL=debug
```

### Performance Optimization

1. **Rate Limiting**
   - Batch processing includes automatic rate limiting
   - 2-second pause every 5 calls
   - Configurable in batch processor

2. **Audio Preprocessing**
   - Consider audio compression for large files
   - Remove silence to reduce processing time

3. **Coaching Customization**
   - Adjust analysis depth based on call success
   - Skip analysis for calls < 2 minutes
   - Use different models for different call types

## Security Considerations

1. **API Key Protection**
   - Store in environment variables only
   - Never commit to version control
   - Rotate keys regularly

2. **Audio Data**
   - Transcriptions stored in database
   - Original audio not stored locally
   - Consider data retention policies

3. **Training Materials**
   - Sensitive sales scripts protected
   - Access control via user roles
   - Audit logs for material changes

## Advanced Configuration

### Custom Coaching Prompts

Modify coaching analysis in `/src/lib/openai/client.ts`:

```typescript
function createCoachingSystemPrompt(trainingContext?: string): string {
  // Customize for your company's specific needs
  return `
Du är en expert på säljcoaching för ${YOUR_COMPANY} solcellsförsäljning.
Fokusera särskilt på:
- Våra unika värdepropositioner
- Konkurrentanalys
- Branschspecifika objections
...
`
}
```

### Model Selection

Configure different models for different scenarios:

```typescript
const modelConfig = {
  shortCalls: 'gpt-4o-mini',    // < 5 minutes
  normalCalls: 'gpt-4o',       // 5-15 minutes
  longCalls: 'gpt-4o',         // > 15 minutes
  batchProcessing: 'gpt-4o-mini' // Cost optimization
}
```

## Production Deployment

1. **Environment Variables**
   ```env
   OPENAI_API_KEY=sk-prod-key-here
   INTERNAL_API_KEY=secure-internal-key
   DEBUG_AI_PROCESSING=false
   ```

2. **Monitoring Setup**
   - Set up API cost alerts
   - Monitor processing success rates
   - Track average response times

3. **Backup Strategy**
   - Regular database backups
   - Training materials backup
   - API usage logs retention

For more information, see the main README.md and system documentation.