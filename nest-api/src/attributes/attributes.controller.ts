import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttributesService } from './attributes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller()
export class AttributesController {
  constructor(private svc: AttributesService) {}

  // ─── PUBLIC ───────────────────────────────────────────────────────────────
  @Get('attributes')
  indexAttr(@Query() query: any): Promise<any> {
    return this.svc.indexAttributes(query);
  }

  @Get('get-attribute/:id')
  showAttr(@Param('id') id: string): Promise<any> {
    return this.svc.showAttribute(id);
  }

  @Get('attribute-values')
  indexVals(@Query() query: any): Promise<any> {
    return this.svc.indexValues(query);
  }

  @Get('get-attribute-value/:id')
  showVal(@Param('id') id: string): Promise<any> {
    return this.svc.showValue(+id);
  }

  // ─── ADMIN PROTECTED ──────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('create-attribute')
  storeAttr(@Body() b: any): Promise<any> {
    return this.svc.storeAttribute(b);
  }

  @UseGuards(JwtAuthGuard)
  @Put('update-attribute/:id')
  updateAttr(@Param('id') id: string, @Body() b: any): Promise<any> {
    return this.svc.updateAttribute(+id, b);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-attribute/:id')
  destroyAttr(@Param('id') id: string): Promise<any> {
    return this.svc.destroyAttribute(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('attribute/:id/status')
  changeAttrStatus(@Param('id') id: string): Promise<any> {
    return this.svc.changeAttributeStatus(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-attribute-value')
  storeVal(@Body() b: any): Promise<any> {
    return this.svc.storeValue(b);
  }

  @UseGuards(JwtAuthGuard)
  @Put('update-attribute-value/:id')
  updateVal(@Param('id') id: string, @Body() b: any): Promise<any> {
    return this.svc.updateValue(+id, b);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-attribute-value/:id')
  destroyVal(@Param('id') id: string): Promise<any> {
    return this.svc.destroyValue(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('attribute-value/:id/status')
  changeValStatus(@Param('id') id: string): Promise<any> {
    return this.svc.changeValueStatus(+id);
  }
}
