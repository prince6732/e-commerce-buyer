import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller()
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // ==========================================
  // 1. PUBLIC ENDPOINTS (Active records only)
  // ==========================================

  @Get('states')
  getStates() {
    return this.locationsService.getStates();
  }

  @Get('cities')
  getCities(
    @Query('state_id') stateId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.locationsService.getCities({
      state_id: stateId ? parseInt(stateId, 10) : undefined,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('states/:id/cities')
  getCitiesByState(@Param('id', ParseIntPipe) id: number) {
    return this.locationsService.getCitiesByState(id);
  }

  // ==========================================
  // 2. ADMIN STATES ENDPOINTS
  // ==========================================

  @UseGuards(JwtAuthGuard)
  @Get('admin/locations/states')
  getAdminStates(@Query() query: any) {
    return this.locationsService.getAdminStates(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/locations/states/all')
  getAllAdminStatesList() {
    return this.locationsService.getAllAdminStatesList();
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/locations/states/:id')
  getStateById(@Param('id', ParseIntPipe) id: number) {
    return this.locationsService.getStateById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/locations/states')
  createState(@Body() body: { name: string; status?: boolean }) {
    return this.locationsService.createState(body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/locations/states/:id')
  updateState(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; status?: boolean },
  ) {
    return this.locationsService.updateState(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/locations/states/:id/toggle-status')
  toggleStateStatus(@Param('id', ParseIntPipe) id: number) {
    return this.locationsService.toggleStateStatus(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/locations/states/:id')
  deleteState(@Param('id', ParseIntPipe) id: number) {
    return this.locationsService.deleteState(id);
  }

  // ==========================================
  // 3. ADMIN CITIES ENDPOINTS
  // ==========================================

  @UseGuards(JwtAuthGuard)
  @Get('admin/locations/cities')
  getAdminCities(@Query() query: any) {
    return this.locationsService.getAdminCities(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/locations/cities/:id')
  getCityById(@Param('id', ParseIntPipe) id: number) {
    return this.locationsService.getCityById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/locations/cities')
  createCity(@Body() body: { name: string; state_id: number; status?: boolean }) {
    return this.locationsService.createCity(body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/locations/cities/:id')
  updateCity(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; state_id?: number; status?: boolean },
  ) {
    return this.locationsService.updateCity(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/locations/cities/:id/toggle-status')
  toggleCityStatus(@Param('id', ParseIntPipe) id: number) {
    return this.locationsService.toggleCityStatus(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/locations/cities/:id')
  deleteCity(@Param('id', ParseIntPipe) id: number) {
    return this.locationsService.deleteCity(id);
  }
}
